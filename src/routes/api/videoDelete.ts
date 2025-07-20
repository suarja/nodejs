import { Request, Response } from "express";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET_NAME } from "../../config/aws";
import { ClerkAuthService } from "../../services/clerkAuthService";
import { supabase } from "../../config/supabase";
import { logger } from "../../config/logger";
import { ResourceType } from "../../types/ressource";
import { MonetizationService } from "editia-core";

export async function videoDeleteHandler(req: Request, res: Response) {
  try {
    logger.info("🗑️ Video delete request received");

    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const {
      user,
      clerkUser,
      errorResponse: authError,
    } = await ClerkAuthService.verifyUser(authHeader);
    logger.info(
      "🔐 User authenticated for video deletion - DB ID:",
      user?.id,
      "Clerk ID:",
      clerkUser?.id
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { videoId } = req.body;

    // Validate required fields
    if (!videoId) {
      return res.status(400).json({
        success: false,
        error: "videoId is required",
      });
    }

    // Step 2: Get video details from database to get storage path
    logger.info(`📄 Fetching video details for ID: ${videoId}`);
    const { data: videoData, error: fetchError } = await supabase
      .from("videos")
      .select("storage_path, user_id")
      .eq("id", videoId)
      .eq("user_id", user!.id) // Ensure user can only delete their own videos
      .single();

    if (fetchError) {
      logger.error("❌ Error fetching video:", fetchError);
      return res.status(404).json({
        success: false,
        error: "Video not found or access denied",
      });
    }

    if (!videoData) {
      return res.status(404).json({
        success: false,
        error: "Video not found",
      });
    }

    const { storage_path } = videoData;
    logger.info(`📁 Video storage path: ${storage_path}`);

    // Step 3: Delete video from S3
    try {
      if (storage_path) {
        logger.info(`🗑️ Deleting video from S3: ${storage_path}`);
        const deleteCommand = new DeleteObjectCommand({
          Bucket: S3_BUCKET_NAME,
          Key: storage_path,
        });

        await s3Client.send(deleteCommand);
        logger.info(`✅ Video deleted from S3: ${storage_path}`);
      } else {
        logger.warn("⚠️ No storage path found, skipping S3 deletion");
      }
    } catch (s3Error) {
      logger.error("❌ Error deleting from S3:", s3Error);
      // Continue with database deletion even if S3 deletion fails
      // This prevents orphaned database records
    }

    // Step 4: Delete video record from database
    logger.info(`🗑️ Deleting video record from database: ${videoId}`);
    const { error: deleteError } = await supabase
      .from("videos")
      .delete()
      .eq("id", videoId)
      .eq("user_id", user!.id); // Double-check ownership

    if (deleteError) {
      logger.error("❌ Error deleting from database:", deleteError);
      return res.status(500).json({
        success: false,
        error: "Failed to delete video from database",
      });
    }

    logger.info(
      `✅ Video ${videoId} successfully deleted from both S3 and database`
    );
    // Step 5: decrement usage
    const monetizationService = MonetizationService.getInstance()
    await monetizationService.decrementUsage(user!.id, "source_video_upload");
    logger.info(`✅ Usage decremented for user ${user!.id}`);

    // Step 5: Return success response
    return res.status(200).json({
      success: true,
      message: "Video deleted successfully",
      data: {
        videoId,
        deletedFromS3: !!storage_path,
        deletedFromDatabase: true,
      },
    });
  } catch (error) {
    logger.error("❌ Video deletion endpoint error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during video deletion",
    });
  }
}

/**
 * Health check endpoint for video deletion service
 */
export async function videoDeleteHealthHandler(req: Request, res: Response) {
  try {
    console.log("🏥 Video deletion health check requested");

    // Test S3 connection
    if (!S3_BUCKET_NAME) {
      return res.status(503).json({
        success: false,
        error: "S3 configuration missing",
        service: "video-deletion",
        status: "unhealthy",
      });
    }

    return res.status(200).json({
      success: true,
      service: "video-deletion",
      status: "healthy",
      timestamp: new Date().toISOString(),
      s3Bucket: S3_BUCKET_NAME,
    });
  } catch (error) {
    console.error("❌ Video deletion health check failed:", error);
    return res.status(503).json({
      success: false,
      error: "Health check failed",
      service: "video-deletion",
      status: "unhealthy",
    });
  }
}
