import express from 'express';
import { AuthService } from '../../services/authService';
import { uploadS3Handler } from './s3Upload';
import { generateVideoHandler, getVideoStatusHandler } from './videos';
import promptsRouter from './prompts';
import webhooksRouter from './webhooks';

const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// S3 upload endpoint (auth handled in the handler)
apiRouter.post('/s3-upload', uploadS3Handler);

// Video generation endpoints (auth handled in the handlers)
apiRouter.post('/videos/generate', generateVideoHandler);
apiRouter.get('/videos/status/:id', getVideoStatusHandler);

// Prompt enhancement endpoints
apiRouter.use('/prompts', promptsRouter);

// Webhook endpoints
apiRouter.use('/webhooks', webhooksRouter);

// List video requests endpoint
apiRouter.get('/videos', async (req, res) => {
  try {
    // Step 1: Authenticate user using AuthService
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await AuthService.verifyUser(
      authHeader
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    // Get the user's video requests (latest first)
    const { data: videoRequests, error } = await (
      await import('../../config/supabase')
    ).supabase
      .from('video_requests')
      .select('id, status, created_at, payload, result_data, error_message')
      .eq('user_id', user.id)
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
