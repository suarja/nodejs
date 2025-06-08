import { User } from '@supabase/supabase-js';
import { supabase } from '../../config/supabase';
import { ScriptGenerator } from '../scriptGenerator';
import { ScriptReviewer } from '../scriptReviewer';
import { CreatomateBuilder } from '../creatomateBuilder';
import { MODELS } from '../../config/openai';
import { PromptService } from '../promptService';
import { convertCaptionConfigToCreatomate } from '../../utils/video/caption-converter';
import {
  EditorialProfile,
  VideoGenerationPayload,
  VideoValidationService,
} from './validation';
import { VideoGenerationResult, ValidatedVideo } from '../../types/video';
export enum VideoRequestStatus {
  QUEUED = 'queued',
  RENDERING = 'rendering',
  COMPLETED = 'done',
  FAILED = 'error',
}
/**
 * Enhanced video generation service with async background processing
 *
 * Key difference from original: Instead of waiting for the entire process,
 * we return immediately after creating the video request, then process in background
 */
export class VideoGeneratorService {
  private user: User;
  private scriptGenerator: ScriptGenerator;
  private scriptReviewer: ScriptReviewer;
  private creatomateBuilder: CreatomateBuilder;

  // Timeout configurations
  private static readonly SCRIPT_GENERATION_TIMEOUT = 60000; // 60 seconds
  private static readonly CREATOMATE_API_TIMEOUT = 120000; // 2 minutes
  private static readonly DATABASE_OPERATION_TIMEOUT = 30000; // 30 seconds

  /**
   * Create a new video generator service instance
   * @param user The authenticated user
   */
  constructor(user: User) {
    this.user = user;
    this.scriptGenerator = ScriptGenerator.getInstance(MODELS['o4-mini']);
    this.scriptReviewer = ScriptReviewer.getInstance(MODELS['o4-mini']);
    this.creatomateBuilder = CreatomateBuilder.getInstance(MODELS['4.1']);
  }

  /**
   * MAIN DIFFERENCE: This now creates the video request and returns immediately,
   * then starts background processing
   *
   * @param payload The video generation payload
   * @returns The result with request ID for immediate response
   */
  async generateVideo(
    payload: VideoGenerationPayload
  ): Promise<VideoGenerationResult> {
    const startTime = Date.now();

    try {
      const {
        prompt,
        systemPrompt,

        outputLanguage,
        editorialProfile,
      } = payload;

      console.log(`🎬 Starting video generation for user ${this.user.id}`);

      // Step 1: Create video request record FIRST (this is what we return immediately)
      const videoRequest = await this.withTimeout(
        this.createVideoRequest(payload),
        VideoGeneratorService.DATABASE_OPERATION_TIMEOUT,
        'Database operation timed out'
      );

      console.log(
        `✅ Video request created: ${videoRequest.id} - returning to frontend`
      );

      // Step 2: Generate and review script with timeout
      const { scriptId: generatedScriptId, reviewedScript } =
        await this.withTimeout(
          this.generateAndSaveScript(
            prompt,
            systemPrompt,
            editorialProfile,
            outputLanguage,
            videoRequest.id
          ),
          VideoGeneratorService.SCRIPT_GENERATION_TIMEOUT,
          'Script generation timed out'
        );
      const scriptId = generatedScriptId;

      // Step 3: Start background processing (fire and forget)
      this.processVideoInBackground(
        videoRequest.id,
        payload,
        editorialProfile,
        { scriptId, reviewedScript }
      ).catch((error) => {
        console.error(
          `❌ Background processing failed for request ${videoRequest.id}:`,
          error
        );
      });

      // Step 3: Return immediately with request info
      const duration = Date.now() - startTime;
      console.log(`✅ Video request created and returned in ${duration}ms`);

      return {
        requestId: videoRequest.id,
        scriptId: '', // Will be populated during background processing
        status: VideoRequestStatus.QUEUED,
        estimatedCompletionTime: new Date(Date.now() + 300000), // 5 minutes estimate
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ Video generation setup failed after ${duration}ms:`,
        error
      );

      // Transform and re-throw as VideoGenerationError
      if (error instanceof Error && 'code' in error) {
        throw error; // Already a VideoGenerationError
      }

      throw VideoValidationService.createError(
        error instanceof Error
          ? error.message
          : 'Unknown error during video generation setup',
        'VIDEO_GENERATION_FAILED',
        {
          userId: this.user.id,
          duration,
          originalError: error instanceof Error ? error.message : error,
        },
        true, // Retryable
        'Video generation failed. Please try again.'
      );
    }
  }

  /**
   * Background processing method - this is where the heavy lifting happens
   * This runs after we've already returned the response to the frontend
   */
  private async processVideoInBackground(
    requestId: string,
    payload: VideoGenerationPayload,
    editorialProfile: EditorialProfile,
    script: { scriptId: string; reviewedScript: string }
  ): Promise<void> {
    const startTime = Date.now();

    try {
      console.log(`🔄 Starting background processing for request ${requestId}`);

      // Update status to processing
      await this.updateVideoRequestStatus(
        requestId,
        VideoRequestStatus.RENDERING
      );

      const { prompt, selectedVideos, voiceId, captionConfig, outputLanguage } =
        payload;

      // Step 2: Fetch and validate videos
      const videosObj = await this.withTimeout(
        this.fetchAndValidateVideos(selectedVideos),
        VideoGeneratorService.DATABASE_OPERATION_TIMEOUT,
        'Video validation timed out'
      );

      // Step 3: Generate Creatomate template
      const template = await this.withTimeout(
        this.generateTemplate(
          script.reviewedScript,
          videosObj,
          voiceId,
          editorialProfile,
          captionConfig,
          outputLanguage
        ),
        VideoGeneratorService.SCRIPT_GENERATION_TIMEOUT,
        'Template generation timed out'
      );

      // Step 4: Store training data (fire and forget)
      this.storeTrainingDataAsync(
        prompt,
        script.reviewedScript,
        template,
        requestId
      ).catch((error) => console.warn('Training data storage failed:', error));

      // Step 5: Start Creatomate render
      const renderId = await this.withTimeout(
        this.startCreatomateRender(
          template,
          requestId,
          script.scriptId,
          prompt
        ),
        VideoGeneratorService.CREATOMATE_API_TIMEOUT,
        'Creatomate render start timed out'
      );

      // Step 6: Update video request with completion
      await this.updateVideoRequestWithResults(requestId, {
        status: VideoRequestStatus.COMPLETED,
        scriptId: script.scriptId,
        renderId,
        script: script.reviewedScript,
        template,
      });

      const duration = Date.now() - startTime;
      console.log(
        `✅ Background processing completed for ${requestId} in ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ Background processing failed for ${requestId} after ${duration}ms:`,
        error
      );

      // Update request with failure status
      await this.updateVideoRequestStatus(
        requestId,
        VideoRequestStatus.FAILED,
        error instanceof Error
          ? error.message
          : 'Unknown error during processing'
      );

      // Attempt cleanup on failure
      await this.cleanupOnFailure(script.scriptId, requestId);
    }
  }

  /**
   * Wraps a promise with a timeout
   * @private
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = VideoValidationService.createError(
          timeoutMessage,
          'OPERATION_TIMEOUT',
          { timeoutMs },
          true,
          'Operation timed out. Please try again.'
        );
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]);
  }

  /**
   * Creates the initial video request record
   * @private
   */
  private async createVideoRequest(
    payload: VideoGenerationPayload
  ): Promise<{ id: string }> {
    try {
      // Create a simplified payload for the database that matches mobile app structure
      const { data, error } = await supabase
        .from('video_requests')
        .insert({
          user_id: this.user.id,
          render_status: 'queued',
          selected_videos: payload.selectedVideos.map((v) => v.id),
          caption_config: payload.captionConfig || null,
          output_language: payload.outputLanguage || null,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (error || !data) {
        throw VideoValidationService.createError(
          'Failed to create video request',
          'DATABASE_ERROR',
          { error: error?.message },
          true,
          'Unable to queue video request. Please try again.'
        );
      }

      return data;
    } catch (error) {
      console.error('Database error creating video request:', error);
      throw error;
    }
  }

  /**
   * Updates video request status
   * @private
   */
  private async updateVideoRequestStatus(
    requestId: string,
    status: VideoRequestStatus,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        render_status: status,
        updated_at: new Date().toISOString(),
      };

      if (status === VideoRequestStatus.RENDERING) {
        updateData.processing_started_at = new Date().toISOString();
      } else if (status === VideoRequestStatus.COMPLETED) {
        updateData.completed_at = new Date().toISOString();
      } else if (status === VideoRequestStatus.FAILED && errorMessage) {
        console.warn('Failed to update video request status:', errorMessage);
        updateData.error_message = errorMessage || 'Unknown error';
      }

      const { error } = await supabase
        .from('video_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) {
        console.error(`Failed to update video request ${requestId}:`, error);
      }
    } catch (error) {
      console.error(`Error updating video request ${requestId}:`, error);
    }
  }

  /**
   * Updates video request with final results
   * @private
   */
  private async updateVideoRequestWithResults(
    requestId: string,
    results: {
      status: VideoRequestStatus;
      scriptId: string;
      renderId: string;
      script: string;
      template: any;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('video_requests')
        .update({
          render_status: results.status,
          script_id: results.scriptId,
          render_id: results.renderId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) {
        console.error(
          `Failed to update video request ${requestId} with results:`,
          error
        );
      }
    } catch (error) {
      console.error(
        `Error updating video request ${requestId} with results:`,
        error
      );
    }
  }

  // Placeholder methods - these need to be implemented based on the original logic
  private async generateAndSaveScript(
    prompt: string,
    systemPrompt: string,
    editorialProfile: EditorialProfile,
    outputLanguage: string,
    requestId: string
  ): Promise<{ scriptId: string; reviewedScript: string }> {
    try {
      console.log('🤖 Generating script...');
      const generatedScript = await this.scriptGenerator.generate(
        prompt,
        editorialProfile,
        systemPrompt
      );
      console.log('✅ Script generated successfully');

      console.log('🔍 Reviewing script...');
      const reviewedScript = await this.scriptReviewer.review(
        generatedScript,
        editorialProfile,
        `System Prompt from the user:
        ${systemPrompt}

        User Prompt:
        ${prompt}
        
        Output Language: ${outputLanguage}
        `
      );
      console.log('✅ Script reviewed successfully');

      console.log('💾 Creating script record...');
      const { data: script, error: scriptError } = await supabase
        .from('scripts')
        .insert({
          user_id: this.user.id,
          raw_prompt: prompt,
          generated_script: reviewedScript,
          status: 'validated',
          output_language: outputLanguage,
        })
        .select()
        .single();

      await supabase
        .from('video_requests')
        .update({
          script_id: script.id,
        })
        .eq('id', requestId);

      if (scriptError) {
        throw VideoValidationService.createError(
          'Failed to save script to database',
          'SCRIPT_SAVE_ERROR',
          { originalError: scriptError },
          true,
          'Failed to save the generated script. Please try again.'
        );
      }

      console.log(`✅ Script created: ${script.id}`);
      return { scriptId: script.id, reviewedScript };
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error; // Re-throw VideoGenerationError
      }

      throw VideoValidationService.createError(
        'Script generation failed',
        'SCRIPT_GENERATION_ERROR',
        { originalError: error },
        true,
        'Failed to generate the video script. Please try again.'
      );
    }
  }

  private async fetchAndValidateVideos(
    selectedVideos: any[]
  ): Promise<ValidatedVideo[]> {
    try {
      console.log('🔄 Fetching and validating videos...');

      if (!selectedVideos || selectedVideos.length === 0) {
        throw new Error('No videos selected');
      }

      // Extract video IDs from selected videos
      const videoIds = selectedVideos.map((video) => video.id).filter(Boolean);

      if (videoIds.length === 0) {
        throw new Error('No valid video IDs found in selected videos');
      }

      // Fetch videos from database
      const { data: videos, error: fetchError } = await supabase
        .from('videos')
        .select('id, title, description, upload_url, tags, user_id')
        .in('id', videoIds)
        .eq('user_id', this.user.id); // Ensure user owns these videos

      if (fetchError) {
        console.error('❌ Failed to fetch videos:', fetchError);
        throw new Error(`Failed to fetch videos: ${fetchError.message}`);
      }

      if (!videos || videos.length === 0) {
        throw new Error(
          'No accessible videos found. Please ensure videos are uploaded and processing is complete.'
        );
      }

      // Validate and transform videos using the validation service
      const validatedVideos: ValidatedVideo[] = videos.map((video) => ({
        id: video.id,
        url: video.upload_url,
        title: video.title,
        description: video.description,
        tags: video.tags || [],
      }));

      if (validatedVideos.length === 0) {
        throw new Error('No valid videos found after validation');
      }

      console.log(`✅ Validated ${validatedVideos.length} videos`);

      return validatedVideos;
    } catch (error) {
      console.error('❌ Video fetching and validation failed:', error);
      throw VideoValidationService.createError(
        `Video validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'VIDEO_VALIDATION_FAILED',
        {
          userId: this.user.id,
          selectedVideoCount: selectedVideos?.length || 0,
        },
        true,
        'Failed to validate selected videos. Please check your video selections.'
      );
    }
  }

  private async generateTemplate(
    script: string,
    validatedVideos: ValidatedVideo[],
    voiceId: string,
    editorialProfile: EditorialProfile,
    captionConfig?: any,
    outputLanguage?: string
  ): Promise<any> {
    try {
      console.log('🔄 Generating Creatomate template...');

      // Transform validated videos for CreatomateBuilder
      const selectedVideos = validatedVideos.map((video) => ({
        id: video.id,
        url: video.url,
        title: video.title,
        description: video.description,
        tags: video.tags || [],
      }));

      // Get the creatomate-builder-agent prompt from the prompt bank
      const promptTemplate = PromptService.fillPromptTemplate(
        'video-creatomate-agent-v2',
        {
          script,
          scenePlan: 'Will be generated by the builder',
          voiceId,
          outputLanguage: outputLanguage || 'en',
          captionInfo: captionConfig
            ? `Caption Config: ${JSON.stringify(captionConfig)}`
            : '',
        }
      );

      // Convert caption configuration to Creatomate format
      const captionStructure = convertCaptionConfigToCreatomate(captionConfig);

      // Generate template using CreatomateBuilder with prompt bank system
      const template = await this.creatomateBuilder.buildJson({
        script: script,
        selectedVideos: selectedVideos,
        voiceId: voiceId,
        editorialProfile: editorialProfile,
        captionStructure: captionStructure,
        agentPrompt: promptTemplate?.system,
      });

      console.log('✅ Creatomate template generated successfully');

      return template;
    } catch (error) {
      console.error('❌ Template generation failed:', error);
      throw VideoValidationService.createError(
        `Template generation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        'TEMPLATE_GENERATION_FAILED',
        { userId: this.user.id, videoCount: validatedVideos.length },
        true,
        'Failed to generate video template. Please try again.'
      );
    }
  }

  private async storeTrainingDataAsync(
    prompt: string,
    script: string,
    template: any,
    videoRequestId: string
  ): Promise<void> {
    try {
      console.log('🔄 Storing training data...');

      // Store training data for ML improvements
      const trainingData = {
        user_id: this.user.id,
        raw_prompt: prompt,
        generated_script: script,
        creatomate_template: template,
        video_request_id: videoRequestId,
        created_at: new Date().toISOString(),
      };

      const { error: trainingError } = await supabase
        .from('rl_training_data')
        .insert(trainingData);

      if (trainingError) {
        // Don't throw here - training data storage is optional and shouldn't break the main flow
        console.warn('⚠️ Failed to store training data:', trainingError);
        return;
      }

      console.log('✅ Training data stored successfully');
    } catch (error) {
      // Training data storage is non-critical, so we just log and continue
      console.warn('⚠️ Error storing training data:', error);
    }
  }

  private async startCreatomateRender(
    template: any,
    requestId: string,
    scriptId: string,
    prompt: string
  ): Promise<string> {
    try {
      console.log('🚀 Starting Creatomate render...');

      // Get the server's base URL for webhook callbacks
      const baseUrl = 'https://nodejs-production-a774.up.railway.app';
      const webhookUrl = `${baseUrl}/api/webhooks/creatomate`;

      const renderPayload = {
        template_id: 'a5403674-6eaf-4114-a088-4d560d851aef',
        modifications: template,
        webhook_url: webhookUrl,
        output_format: 'mp4',
        frame_rate: 30,
        render_scale: 1.0,
        metadata: JSON.stringify({
          requestId,
          userId: this.user.id,
          scriptId,
          prompt: prompt.substring(0, 100), // Truncate long prompts
          timestamp: new Date().toISOString(),
        }),
      };

      const renderResponse = await fetch(
        'https://api.creatomate.com/v1/renders',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(renderPayload),
        }
      );

      if (!renderResponse.ok) {
        const errorData = await renderResponse.json().catch(() => ({}));

        throw VideoValidationService.createError(
          'Creatomate API request failed',
          'CREATOMATE_API_ERROR',
          {
            status: renderResponse.status,
            statusText: renderResponse.statusText,
            errorData,
          },
          renderResponse.status >= 500, // Retry on server errors
          'Video rendering service is temporarily unavailable. Please try again.'
        );
      }

      const renderData = (await renderResponse.json()) as any[];
      const renderId = renderData[0]?.id;

      if (!renderId) {
        throw VideoValidationService.createError(
          'Invalid response from Creatomate API',
          'CREATOMATE_INVALID_RESPONSE',
          { renderData },
          true,
          'Video rendering service returned an invalid response. Please try again.'
        );
      }

      console.log(`✅ Render started: ${renderId}`);
      return renderId;
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        throw error;
      }

      throw VideoValidationService.createError(
        'Failed to start render',
        'RENDER_START_ERROR',
        { originalError: error },
        true,
        'Failed to start video rendering. Please try again.'
      );
    }
  }

  private async cleanupOnFailure(
    scriptId: string | null,
    videoRequestId: string | null
  ): Promise<void> {
    console.log('🧹 Cleaning up after failure...');
    // TODO: Implement cleanup logic
  }
}
