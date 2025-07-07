import { Request, Response } from "express";
import {
  geminiService,
  GeminiAnalysisResponse,
} from "../../services/geminiService";
import { ClerkAuthService } from "../../services/clerkAuthService";

export async function videoAnalysisHandler(req: Request, res: Response) {
  try {
    console.log("🧠 Video analysis request received");

    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const {
      user,
      clerkUser,
      errorResponse: authError,
    } = await ClerkAuthService.verifyUser(authHeader);
    console.log(
      "🔐 User authenticated for video analysis - DB ID:",
      user?.id,
      "Clerk ID:",
      clerkUser?.id
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { videoUrl } = req.body;
    console.log("videoUrl", videoUrl);
    // Validate required fields
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: "videoUrl is required",
      });
    }

    // Step 3: Analyze video with Gemini
    let analysisResult: GeminiAnalysisResponse | null = null;
    try {
      analysisResult = await geminiService.analyzeVideoFromS3(videoUrl);

      if (!analysisResult.success) {
        // Check if it's the expected "cannot access" error
        if (
          analysisResult.error?.includes(
            "Cannot access or analyze video content"
          )
        ) {
          console.log(
            "📹 Video not accessible to Gemini - this is expected, proceeding with manual editing"
          );

          // Return success response indicating manual editing is needed
          return res.status(200).json({
            success: true,
            data: {
              requires_manual_edit: true,
              reason: "video_not_accessible",
              message:
                "The video could not be analyzed automatically. Manual editing is required.",
            },
          });
        }

        throw new Error(analysisResult.error || "Analysis failed");
      }
    } catch (analysisError) {
      console.error("❌ Video analysis failed:", analysisError);

      // Check if it's the expected error
      const errorMessage =
        analysisError instanceof Error
          ? analysisError.message
          : "Analysis failed";
      if (errorMessage.includes("Cannot access or analyze video content")) {
        console.log(
          "📹 Video analysis not possible - redirecting to manual editing"
        );

        return res.status(200).json({
          success: true,
          data: {
            requires_manual_edit: true,
            reason: "analysis_not_possible",
            message:
              "Automatic analysis is not available for this video. Please edit manually.",
          },
        });
      }

      return res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }

    console.log(
      `✅ Video processing completed for user ${user!.id} in ${
        analysisResult.analysis_time
      }ms`
    );

    // Step 5: Return success response with analysis data
    return res.status(200).json({
      success: true,
      data: {
        analysis_data: analysisResult.data,
        analysis_time: analysisResult.analysis_time,
        method_used: analysisResult.method_used,
      },
    });
  } catch (error) {
    console.error("❌ Video analysis endpoint error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during video analysis",
    });
  }
}

/**
 * Health check endpoint for video analysis service
 */
export async function videoAnalysisHealthHandler(req: Request, res: Response) {
  try {
    console.log("🏥 Video analysis health check requested");

    // Test Gemini service connection
    const isHealthy = await geminiService.testConnection();

    if (!isHealthy) {
      return res.status(503).json({
        success: false,
        error: "Gemini service is not available",
        service: "video-analysis",
        status: "unhealthy",
      });
    }

    return res.status(200).json({
      success: true,
      service: "video-analysis",
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Video analysis health check failed:", error);
    return res.status(503).json({
      success: false,
      error: "Health check failed",
      service: "video-analysis",
      status: "unhealthy",
    });
  }
}
