import { Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { ClerkAuthService } from "../../services/clerkAuthService";
import {
  successResponseExpress,
  errorResponseExpress,
  HttpStatus,
} from "../../utils/api/responses";
import {
  checkUsageLimit,
  incrementUsage,
} from "../../services/usageTrackingService";

/**
 * Save source video metadata after successful S3 upload
 */
export async function saveSourceVideoHandler(req: Request, res: Response) {
  try {
    console.log("💾 Save source video request received");

    // Step 1: Authenticate user
    const authHeader = req.headers.authorization;
    const {
      user,
      clerkUser,
      errorResponse: authError,
    } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return res.status(authError.status).json(authError);
    }
    const userId = user!.id;
    console.log(
      "🔐 User authenticated for source video save - DB ID:",
      userId,
      "Clerk ID:",
      clerkUser?.id
    );

    // Step 2: Check usage limit before proceeding
    const { limitReached } = await checkUsageLimit(userId, "source_videos");
    if (limitReached) {
      console.warn(`
      source_videos limit reached for user ${userId}`);
      return errorResponseExpress(
        res,
        "Source video limit reached. Please delete a video to upload a new one.",
        HttpStatus.FORBIDDEN
      );
    }

    // Step 3: Validate request body
    const {
      title,
      description,
      tags,
      uploadUrl,
      storagePath,
      durationSeconds,
    } = req.body;

    if (!uploadUrl || !storagePath) {
      return errorResponseExpress(
        res,
        "uploadUrl and storagePath are required",
        HttpStatus.BAD_REQUEST
      );
    }

    // Step 4: Insert video metadata into database
    const { data: videoData, error: insertError } = await supabase
      .from("videos")
      .insert({
        user_id: userId,
        title: title || "",
        description: description || "",
        tags: Array.isArray(tags) ? tags : [],
        upload_url: uploadUrl,
        storage_path: storagePath,
        duration_seconds: durationSeconds || 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ Database insert error:", insertError);
      return errorResponseExpress(
        res,
        "Failed to save video metadata",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    console.log("✅ Source video saved successfully:", videoData.id);

    // Step 5: Increment usage count
    await incrementUsage(userId, "source_videos");

    return successResponseExpress(
      res,
      {
        id: videoData.id,
        message: "Source video saved successfully",
        video: videoData,
      },
      HttpStatus.CREATED
    );
  } catch (error) {
    console.error("❌ Save source video error:", error);
    return errorResponseExpress(
      res,
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Get user's source videos
 */
export async function getSourceVideosHandler(req: Request, res: Response) {
  try {
    console.log("📹 Get source videos request received");

    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } =
      await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    console.log("🔐 Fetching source videos for user DB ID:", user?.id);

    // Step 2: Fetch user's videos
    const { data: videos, error } = await supabase
      .from("videos")
      .select("*")
      .eq("user_id", user!.id) // Use database user ID directly
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching source videos:", error);
      return errorResponseExpress(
        res,
        "Failed to fetch source videos",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    console.log(
      `✅ Retrieved ${videos?.length || 0} source videos for user ${user!.id}`
    );

    return successResponseExpress(res, {
      videos: videos || [],
      count: videos?.length || 0,
    });
  } catch (error) {
    console.error("❌ Get source videos error:", error);
    return errorResponseExpress(
      res,
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * Update source video metadata
 */
export async function updateSourceVideoHandler(req: Request, res: Response) {
  try {
    console.log("✏️ Update source video request received");

    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } =
      await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { videoId } = req.params;
    const { title, description, tags } = req.body;

    if (!videoId) {
      return errorResponseExpress(
        res,
        "Video ID is required",
        HttpStatus.BAD_REQUEST
      );
    }

    // Step 2: Update video metadata
    const { data: updatedVideo, error: updateError } = await supabase
      .from("videos")
      .update({
        title,
        description,
        tags: Array.isArray(tags) ? tags : [],
      })
      .eq("id", videoId)
      .eq("user_id", user!.id) // Ensure user owns the video
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error updating video:", updateError);
      return errorResponseExpress(
        res,
        "Failed to update video",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    if (!updatedVideo) {
      return errorResponseExpress(
        res,
        "Video not found or you do not have permission to update it",
        HttpStatus.NOT_FOUND
      );
    }

    console.log("✅ Source video updated successfully:", updatedVideo.id);

    return successResponseExpress(res, {
      message: "Video updated successfully",
      video: updatedVideo,
    });
  } catch (error) {
    console.error("❌ Update source video error:", error);
    return errorResponseExpress(
      res,
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
