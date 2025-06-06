import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { AuthService } from '../../services/authService';
import { VideoValidationService } from '../../services/video/validation';
import { VideoGeneratorService } from '../../services/video/generator';
import { VideoStatusResponse, ApiResponse } from '../../types/video';
import {
  successResponseExpress,
  errorResponseExpress,
  HttpStatus,
} from '../../utils/api/responses';

/**
 * Video generation API controller matching the original mobile app
 *
 * Key difference: This responds immediately after creating the video request,
 * then processes in the background
 */
export async function generateVideoHandler(req: Request, res: Response) {
  console.log('🎬 Starting video generation request...');

  try {
    // Step 1: Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await AuthService.verifyUser(
      authHeader
    );

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    console.log('🔐 User authenticated:', user.id);

    // Step 2: Parse and validate request
    let requestBody;
    try {
      requestBody = req.body;
    } catch (error) {
      console.error('❌ Invalid JSON in request body:', error);
      return errorResponseExpress(
        res,
        'Invalid JSON in request body',
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

    console.log('✅ Video generation process initiated successfully');

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
    console.error('❌ Error in video generation:', error);

    // Determine appropriate status code based on error type
    const statusCode = determineErrorStatusCode(error);

    // Return error response
    return errorResponseExpress(
      res,
      error.message || 'Failed to process video request',
      statusCode,
      process.env.NODE_ENV === 'development'
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
    (error.code.startsWith('22') || // Data exception
      error.code.startsWith('23') || // Integrity constraint violation
      error.code === 'PGRST') // PostgREST error
  ) {
    return HttpStatus.BAD_REQUEST;
  }

  // Authentication/authorization errors
  if (
    error.message &&
    (error.message.includes('auth') ||
      error.message.includes('token') ||
      error.message.includes('unauthorized') ||
      error.message.includes('permission'))
  ) {
    return HttpStatus.UNAUTHORIZED;
  }

  // Missing resources
  if (
    error.message &&
    (error.message.includes('not found') || error.message.includes('missing'))
  ) {
    return HttpStatus.NOT_FOUND;
  }

  // External API errors (Creatomate)
  if (error.message && error.message.includes('Creatomate')) {
    return HttpStatus.SERVICE_UNAVAILABLE;
  }

  // Default to internal server error
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

// Get video status endpoint
export async function getVideoStatusHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Step 1: Authenticate user using AuthService
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await AuthService.verifyUser(
      authHeader
    );

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    const { data: videoRequest, error } = await supabase
      .from('video_requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error || !videoRequest) {
      return errorResponseExpress(
        res,
        'Video request not found',
        HttpStatus.NOT_FOUND
      );
    }

    // Get queue position if still queued
    let queuePosition: number | undefined;
    if (videoRequest.status === 'queued') {
      const { count } = await supabase
        .from('video_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued')
        .lt('created_at', videoRequest.created_at);

      queuePosition = (count || 0) + 1;
    }

    const response: VideoStatusResponse = {
      id: videoRequest.id,
      status: videoRequest.status,
      queuePosition,
      estimatedWaitTime: queuePosition
        ? `${Math.max(1, Math.ceil(queuePosition * 0.5))} minutes`
        : undefined,
      progress:
        videoRequest.status === 'processing'
          ? 50
          : videoRequest.status === 'completed'
          ? 100
          : 0,
      error: videoRequest.error_message || undefined,
      result: videoRequest.result_data || undefined,
    };

    return successResponseExpress(res, response);
  } catch (error) {
    console.error('❌ Video status error:', error);
    return errorResponseExpress(
      res,
      'Internal server error',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
