import { Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { ClerkAuthService } from "../../services/clerkAuthService";
import { VideoValidationService } from "../../services/video/validation";
import { VideoGeneratorService } from "../../services/video/generator";
import {
  successResponseExpress,
  errorResponseExpress,
  HttpStatus,
} from "../../utils/api/responses";
import { CreatomateRenderResponseSchema } from "../../types/renders";
import {
  usageLimiter,
  incrementResourceUsage,
} from "../../middleware/usageLimitMiddleware";
import { VideoRequestStatus } from "../../types/video";
import { ResourceType } from "../../types/ressource";

/**
 * Video generation API controller matching the original mobile app
 *
 * Key difference: This responds immediately after creating the video request,
 * then processes in the background
 */
export async function generateVideoHandler(req: Request, res: Response) {
  console.log("🎬 Starting video generation request...");

  try {
    // Middleware has already authenticated user and checked usage limit.
    // The user object is attached to the request.
    const user = (req as any).user;
    console.log("🔐 User authenticated - DB ID:", user?.id);

    // Step 2: Parse and validate request
    let requestBody;
    try {
      requestBody = req.body;
    } catch (error) {
      console.error("❌ Invalid JSON in request body:", error);
      return errorResponseExpress(
        res,
        "Invalid JSON in request body",
        HttpStatus.BAD_REQUEST
      );
    }

    // Step 3: Validate request body using the proper validation service
    const validationResult =
      VideoValidationService.validateRequest(requestBody);
    if (!validationResult.success) {
      return errorResponseExpress(
        res,
        validationResult.error.message,
        validationResult.error.status,
        validationResult.error.details
      );
    }

    // Step 4: Generate video using the proper generator service
    const videoGenerator = new VideoGeneratorService(user);
    const result = await videoGenerator.generateVideo(validationResult.payload);

    // Increment usage *after* the request is successfully created
    await incrementResourceUsage(user.id, ResourceType.VIDEOS_GENERATED);

    console.log("✅ Video generation process initiated successfully");

    // Step 5: Return success response immediately (this is the key difference!)
    return successResponseExpress(
      res,
      {
        requestId: result.requestId,
        scriptId: result.scriptId,
        status: result.status,
        estimatedCompletionTime: result.estimatedCompletionTime,
      },
      HttpStatus.CREATED
    );
  } catch (error: any) {
    // Log error with stack trace for debugging
    console.error("❌ Error in video generation:", error);

    // Determine appropriate status code based on error type
    const statusCode = determineErrorStatusCode(error);

    // Return error response
    return errorResponseExpress(
      res,
      error.message || "Failed to process video request",
      statusCode,
      process.env.NODE_ENV === "development"
        ? { stack: error.stack }
        : undefined
    );
  }
}

/**
 * Determines the appropriate HTTP status code based on error type
 */
function determineErrorStatusCode(error: any): number {
  // Database errors
  if (
    error.code &&
    (error.code.startsWith("22") || // Data exception
      error.code.startsWith("23") || // Integrity constraint violation
      error.code === "PGRST") // PostgREST error
  ) {
    return HttpStatus.BAD_REQUEST;
  }

  // Authentication/authorization errors
  if (
    error.message &&
    (error.message.includes("auth") ||
      error.message.includes("token") ||
      error.message.includes("unauthorized") ||
      error.message.includes("permission"))
  ) {
    return HttpStatus.UNAUTHORIZED;
  }

  // Missing resources
  if (
    error.message &&
    (error.message.includes("not found") || error.message.includes("missing"))
  ) {
    return HttpStatus.NOT_FOUND;
  }

  // External API errors (Creatomate)
  if (error.message && error.message.includes("Creatomate")) {
    return HttpStatus.SERVICE_UNAVAILABLE;
  }

  // Default to internal server error
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

// Get video status endpoint
export async function getVideoStatusHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return errorResponseExpress(
        res,
        "Video ID is required",
        HttpStatus.BAD_REQUEST
      );
    }
    console.log("id- +api", id);
    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } =
      await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    const { data: videoRequest, error } = await supabase
      .from("video_requests")
      .select("*")
      .eq("id", id)
      .eq("user_id", user!.id)
      .single();

    if (error || !videoRequest) {
      return errorResponseExpress(
        res,
        "Video request not found",
        HttpStatus.NOT_FOUND
      );
    }

    // If the video is still rendering, check Creatomate status
    if (
      videoRequest.render_status === VideoRequestStatus.RENDERING &&
      videoRequest.render_id
    ) {
      try {
        // Check Creatomate status
        const url = `https://api.creatomate.com/v1/renders/${videoRequest.render_id}`;
        console.log("url- +api", url);
        const renderResponse = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
          },
        });
        console.log("renderResponse- +api", renderResponse);

        if (renderResponse.ok) {
          const renderData = CreatomateRenderResponseSchema.parse(
            await renderResponse.json()
          );
          console.log("Creatomate render status:", renderData.status);
          console.log("Creatomate render data:", renderData);
          // Update database based on Creatomate status
          if (renderData.status === "succeeded") {
            const { error: updateError } = await supabase
              .from("video_requests")
              .update({
                render_status: VideoRequestStatus.COMPLETED,
                render_url: renderData.url,
                snapshot_url: renderData.snapshot_url,
              })
              .eq("id", id);

            if (updateError) {
              console.error("Error updating video status:", updateError);
            } else {
              // Update the response object with the new status
              videoRequest.render_status = "done";
              videoRequest.render_url = renderData.url;
              videoRequest.snapshot_url = renderData.snapshot_url;
            }
          } else if (renderData.status === "failed") {
            const { error: updateError } = await supabase
              .from("video_requests")
              .update({
                render_status: "error",
                snapshot_url: null,
                error_message: "Creatomate render failed",
              })
              .eq("id", id);

            if (updateError) {
              console.error("Error updating video status:", updateError);
            } else {
              videoRequest.render_status = "error";
            }
          }
          // If still 'rendering', no need to update
        } else {
          console.error(
            "Error checking Creatomate status:",
            await renderResponse.text()
          );
        }
      } catch (creatomateError) {
        console.error(
          "Error checking Creatomate render status:",
          creatomateError
        );
      }
    }

    return successResponseExpress(res, videoRequest);
  } catch (error) {
    console.error("❌ Video status error:", error);
    return errorResponseExpress(
      res,
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
