import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { AgentService } from '../../services/agentService';
import {
  VideoGenerationRequest,
  VideoGenerationResponse,
  VideoStatusResponse,
  ApiResponse,
} from '../../types/video';
import { EditorialProfile } from '../../types/agents';

// Generate video endpoint
export async function generateVideoHandler(req: Request, res: Response) {
  try {
    console.log('🎬 Video generation request received');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      } as ApiResponse);
    }

    const {
      prompt,
      systemPrompt = '',
      videoUrl,
      videoLanguage = 'en',
      captionPlacement = 'bottom',
      captionLines = 3,
    }: VideoGenerationRequest = req.body;

    // Validate required fields
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required',
      } as ApiResponse);
    }

    // Get user's editorial profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(400).json({
        success: false,
        error: 'Editorial profile not found. Please complete onboarding first.',
      } as ApiResponse);
    }

    // Create video request in queue
    const requestPayload = {
      prompt,
      systemPrompt,
      videoUrl,
      videoLanguage,
      captionPlacement,
      captionLines,
      userId: req.user.id,
    };

    const { data: videoRequest, error: insertError } = await supabase
      .from('video_requests')
      .insert({
        user_id: req.user.id,
        status: 'queued',
        payload: requestPayload,
      })
      .select()
      .single();

    if (insertError || !videoRequest) {
      console.error('❌ Failed to create video request:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create video request',
      } as ApiResponse);
    }

    console.log(`✅ Video request queued: ${videoRequest.id}`);

    // Start processing in the background (fire and forget)
    processVideoRequest(videoRequest.id, requestPayload, profile).catch(
      (error) => {
        console.error('❌ Background video processing failed:', error);
      }
    );

    // Get queue position
    const { count: queuePosition } = await supabase
      .from('video_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .lt('created_at', videoRequest.created_at);

    const response: VideoGenerationResponse = {
      requestId: videoRequest.id,
      status: 'queued',
      queuePosition: (queuePosition || 0) + 1,
      estimatedWaitTime: `${Math.max(
        1,
        Math.ceil((queuePosition || 0) * 0.5)
      )} minutes`,
    };

    return res.status(201).json({
      success: true,
      data: response,
    } as ApiResponse<VideoGenerationResponse>);
  } catch (error) {
    console.error('❌ Video generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
}

// Get video status endpoint
export async function getVideoStatusHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      } as ApiResponse);
    }

    const { data: videoRequest, error } = await supabase
      .from('video_requests')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !videoRequest) {
      return res.status(404).json({
        success: false,
        error: 'Video request not found',
      } as ApiResponse);
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

    return res.status(200).json({
      success: true,
      data: response,
    } as ApiResponse<VideoStatusResponse>);
  } catch (error) {
    console.error('❌ Video status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
}

// Background processing function
async function processVideoRequest(
  requestId: string,
  payload: VideoGenerationRequest,
  profile: any
) {
  try {
    console.log(`🎭 Processing video request: ${requestId}`);

    // Update status to processing
    await supabase
      .from('video_requests')
      .update({
        status: 'processing',
        processing_started_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    // Get agent service
    const agentService = AgentService.getInstance();

    // Convert profile to EditorialProfile type
    const editorialProfile: EditorialProfile = {
      persona_description: profile.persona_description || '',
      tone_of_voice: profile.tone_of_voice || '',
      audience: profile.audience || '',
      style_notes: profile.style_notes || '',
      examples: profile.examples || '',
    };

    // Generate and review script
    const result = await agentService.generateAndReviewScript({
      prompt: payload.prompt,
      systemPrompt: payload.systemPrompt || '',
      editorialProfile,
    });

    console.log(`✅ Script generated for request: ${requestId}`);

    // Update request with completed status and result
    await supabase
      .from('video_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result_data: {
          script: result.review.reviewedScript,
          generation: result.generation,
          review: result.review,
        },
      })
      .eq('id', requestId);

    console.log(`✅ Video request completed: ${requestId}`);
  } catch (error) {
    console.error(`❌ Processing failed for request ${requestId}:`, error);

    // Update request with failed status
    await supabase
      .from('video_requests')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', requestId);
  }
}
