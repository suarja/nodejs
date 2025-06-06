import express from 'express';
import { authenticateUser } from '../../middleware/auth';
import { uploadS3Handler } from './s3Upload';
import { generateVideoHandler, getVideoStatusHandler } from './videos';

const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// S3 upload endpoint (requires authentication)
apiRouter.post('/s3-upload', authenticateUser, uploadS3Handler);

// Video generation endpoints (requires authentication)
apiRouter.post('/videos/generate', authenticateUser, generateVideoHandler);
apiRouter.get('/videos/status/:id', authenticateUser, getVideoStatusHandler);

// List video requests endpoint
apiRouter.get('/videos', authenticateUser, async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    // Get the user's video requests (latest first)
    const { data: videoRequests, error } = await (
      await import('../../config/supabase')
    ).supabase
      .from('video_requests')
      .select('id, status, created_at, payload, result_data, error_message')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Failed to fetch video requests:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch video requests',
      });
    }

    return res.status(200).json({
      success: true,
      data: videoRequests || [],
    });
  } catch (error) {
    console.error('❌ List videos error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default apiRouter;
