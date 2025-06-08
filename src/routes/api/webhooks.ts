import { Router, Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { successResponseExpress } from '../../utils/api/responses';

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
router.post('/creatomate', async (req: Request, res: Response) => {
  try {
    // Parse webhook payload
    const webhookData: CreatomateWebhookData = req.body;
    console.log(
      '📨 Received webhook from Creatomate:',
      JSON.stringify({
        id: webhookData.id,
        status: webhookData.status,
        hasUrl: !!webhookData.url,
        hasMetadata: !!webhookData.metadata,
      })
    );

    // Parse metadata from string to object
    let metadata: RenderMetadata;
    try {
      metadata = webhookData.metadata ? JSON.parse(webhookData.metadata) : {};
    } catch (parseError) {
      console.error('❌ Error parsing metadata:', parseError);
      return res.status(400).json({
        error: 'Invalid metadata format',
        code: 'INVALID_METADATA',
      });
    }

    const { requestId, userId } = metadata;

    // Validate required fields
    if (!requestId || !userId) {
      console.error('❌ Missing required metadata fields:', metadata);
      return res.status(400).json({
        error: 'Missing required metadata fields',
        code: 'MISSING_METADATA',
      });
    }

    // Verify the request exists
    const { data: requestData, error: requestError } = await supabase
      .from('video_requests')
      .select('id, user_id')
      .eq('id', requestId)
      .single();

    if (requestError || !requestData) {
      console.error('❌ Request verification failed:', requestError);
      return res.status(404).json({
        error: 'Invalid request ID',
        code: 'REQUEST_NOT_FOUND',
      });
    }

    // Security check: ensure the user ID matches
    if (requestData.user_id !== userId) {
      console.error('❌ User ID mismatch:', {
        requestUserId: requestData.user_id,
        metadataUserId: userId,
      });
      return res.status(403).json({
        error: 'User ID mismatch',
        code: 'USER_MISMATCH',
      });
    }

    // Update video request status based on render status
    let updateData: Record<string, any> = {};

    if (webhookData.status === 'succeeded') {
      updateData = {
        render_status: 'done',
        render_url: webhookData.url,
      };
      console.log(
        `✅ Render succeeded for request ${requestId}, URL: ${webhookData.url}`
      );
    } else if (webhookData.status === 'failed') {
      updateData = {
        render_status: 'error',
        render_error: webhookData.error || 'Unknown error',
      };
      console.log(
        `❌ Render failed for request ${requestId}: ${
          webhookData.error || 'Unknown error'
        }`
      );
    } else {
      // For any other status, we log but don't update
      console.log(
        `📝 Received status ${webhookData.status} for request ${requestId}`
      );
      return res.json({
        message: `Status ${webhookData.status} acknowledged but no update needed`,
        success: true,
      });
    }

    // Update the database
    const { error: updateError } = await supabase
      .from('video_requests')
      .update(updateData)
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Error updating video request:', updateError);
      return res.status(500).json({
        error: 'Failed to update video request',
        code: 'UPDATE_FAILED',
      });
    }

    // Log the activity (optional, non-blocking)
    try {
      await supabase.from('logs').insert({
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
      console.warn('⚠️ Error logging activity:', logError);
    }

    return res.json({
      success: true,
      message: 'Status updated successfully',
      requestId,
      status: webhookData.status,
    });
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      code: 'WEBHOOK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  return successResponseExpress(res, {
    message: 'Webhook processed successfully',
  });
});

export default router;
