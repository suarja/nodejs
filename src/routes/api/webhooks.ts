import { Router, Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { successResponseExpress } from "../../utils/api/responses";
import { logger } from "../../config/logger";

const router = Router();

interface CreatomateWebhookData {
  id: string; // Render ID
  status: string; // 'succeeded', 'failed', or other status
  url?: string; // URL of the rendered video (if succeeded)
  snapshot_url?: string; // URL of the thumbnail (if succeeded)
  template_id?: string; // ID of the template used
  output_format?: string; // Output format (mp4, jpg, etc.)
  width?: number; // Width of the rendered video
  height?: number; // Height of the rendered video
  frame_rate?: number; // Frame rate of the video
  duration?: number; // Duration in seconds
  file_size?: number; // File size in bytes
  metadata?: string; // String containing JSON metadata
  error?: string; // Error message if failed
}

interface RenderMetadata {
  requestId: string;
  userId: string;
  scriptId?: string;
  prompt?: string;
  timestamp?: string;
}

/**
 * Webhook endpoint for Creatomate render status updates
 */
router.post("/creatomate", async (req: Request, res: Response) => {
  try {
    // Parse webhook payload
    const webhookData: CreatomateWebhookData = req.body;

    // Parse metadata from string to object
    let metadata: RenderMetadata;
    try {
      metadata = webhookData.metadata ? JSON.parse(webhookData.metadata) : {};
    } catch (parseError) {
      logger.error("❌ Error parsing metadata:", {
        error: parseError,
        metadata: webhookData.metadata,
      });
      return res.status(400).json({
        error: "Invalid metadata format",
        code: "INVALID_METADATA",
      });
    }

    const creatomateWebhookChildLogger = logger.child({
      module: "creatomateWebhook",
      requestId: webhookData.id,
      status: webhookData.status,
      url: webhookData.url,
      metadata: webhookData.metadata,
      error: webhookData.error,
      templateId: webhookData.template_id,
      outputFormat: webhookData.output_format,
    });

    const { requestId, userId } = metadata;

    // Validate required fields
    if (!requestId || !userId) {
      creatomateWebhookChildLogger.error(
        "❌ Missing required metadata fields:",
        metadata
      );
      return res.status(400).json({
        error: "Missing required metadata fields",
        code: "MISSING_METADATA",
      });
    }

    // Verify the request exists
    const { data: requestData, error: requestError } = await supabase
      .from("video_requests")
      .select("id, user_id")
      .eq("id", requestId)
      .single();

    if (requestError || !requestData) {
      creatomateWebhookChildLogger.error(
        "❌ Request verification failed:",
        requestError
      );
      return res.status(404).json({
        error: "Invalid request ID",
        code: "REQUEST_NOT_FOUND",
      });
    }

    // Security check: ensure the user ID matches
    if (requestData.user_id !== userId) {
      creatomateWebhookChildLogger.error("❌ User ID mismatch:", {
        requestUserId: requestData.user_id,
        metadataUserId: userId,
      });
      return res.status(403).json({
        error: "User ID mismatch",
        code: "USER_MISMATCH",
      });
    }

    // Update video request status based on render status
    let updateData: Record<string, any> = {};

    if (webhookData.status === "succeeded") {
      updateData = {
        render_status: "done",
        render_url: webhookData.url,
        duration_seconds: webhookData.duration,
        
      };
      creatomateWebhookChildLogger.info(
        `✅ Render succeeded for request ${requestId}, URL: ${webhookData.url}`
      );
    } else if (webhookData.status === "failed") {
      updateData = {
        render_status: "error",
        error_message: webhookData.error || "Unknown error",
      };
      creatomateWebhookChildLogger.info(
        `❌ Render failed for request ${requestId}: ${
          webhookData.error || "Unknown error"
        }`
      );
    } else {
      // For any other status, we log but don't update
      creatomateWebhookChildLogger.info(
        `📝 Received status ${webhookData.status} for request ${requestId}`
      );
      return res.json({
        message: `Status ${webhookData.status} acknowledged but no update needed`,
        success: true,
      });
    }

    // Update the database
    const { error: updateError } = await supabase
      .from("video_requests")
      .update(updateData)
      .eq("id", requestId);

    if (updateError) {
      creatomateWebhookChildLogger.error(
        "❌ Error updating video request:",
        updateError
      );
      return res.status(500).json({
        error: "Failed to update video request",
        code: "UPDATE_FAILED",
      });
    }

    // Only increment usage counter on successful renders
    if (webhookData.status === "succeeded") {
      try {
        // Increment user's videos_generated counter by first getting current value
        const { data: currentUsage, error: fetchError } = await supabase
          .from("user_usage")
          .select("videos_generated")
          .eq("user_id", userId)
          .single();

        if (fetchError) {
          creatomateWebhookChildLogger.error(
            "❌ Error fetching current usage:",
            fetchError
          );
          return;
        }

        const { error: usageError } = await supabase
          .from("user_usage")
          .update({
            videos_generated: (currentUsage?.videos_generated || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        if (usageError) {
          creatomateWebhookChildLogger.error(
            "❌ Error incrementing videos_generated:",
            usageError
          );
        } else {
          creatomateWebhookChildLogger.info(
            `✅ Incremented videos_generated for user ${userId}`
          );
        }
      } catch (error) {
        creatomateWebhookChildLogger.error(
          "❌ Error updating user usage:",
          error
        );
      }
    }

    // Log the activity (optional, non-blocking)
    try {
      await supabase.from("logs").insert({
        user_id: userId,
        action: `render_${webhookData.status}`,
        metadata: {
          requestId,
          renderId: webhookData.id,
          status: webhookData.status,
          scriptId: metadata.scriptId,
          url: webhookData.url,
          duration: webhookData.duration,
          size: webhookData.file_size,
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      creatomateWebhookChildLogger.warn("⚠️ Error logging activity:", logError);
    }

    return res.json({
      success: true,
      message: "Status updated successfully",
      requestId,
      status: webhookData.status,
    });
  } catch (error) {
    logger.error("❌ Error processing webhook:", {
      error,
      requestId: req.body.id,
      status: req.body.status,
      url: req.body.url,
      metadata: req.body.metadata,
      templateId: req.body.template_id,
    });
    res.status(500).json({
      error: "Failed to process webhook",
      code: "WEBHOOK_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
  return successResponseExpress(res, {
    message: "Webhook processed successfully",
  });
});

export default router;
