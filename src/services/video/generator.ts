import { User } from '@supabase/supabase-js';
import { supabase } from '../../config/supabase';
import { ScriptGenerator } from '../scriptGenerator';
import { ScriptReviewer } from '../scriptReviewer';
// import { CreatomateBuilder } from '../creatomateBuilder'; // We'll create this later
import {
  EditorialProfile,
  VideoGenerationPayload,
  VideoValidationService,
} from './validation';
import {
  VideoGenerationResult,
  VideoGenerationError,
  ValidatedVideo,
} from '../../types/video';

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
  // private creatomateBuilder: CreatomateBuilder;

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
    this.scriptGenerator = ScriptGenerator.getInstance();
    this.scriptReviewer = ScriptReviewer.getInstance();
    // this.creatomateBuilder = CreatomateBuilder.getInstance();
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
        selectedVideos,
        editorialProfile,
        voiceId,
        captionConfig,
        outputLanguage,
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

      // Step 2: Start background processing (fire and forget)
      this.processVideoInBackground(
        videoRequest.id,
        payload,
        editorialProfile
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
        status: 'queued',
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
    editorialProfile: EditorialProfile
  ): Promise<void> {
    const startTime = Date.now();
    let scriptId: string | null = null;

    try {
      console.log(`🔄 Starting background processing for request ${requestId}`);

      // Update status to processing
      await this.updateVideoRequestStatus(requestId, 'processing');

      const {
        prompt,
        systemPrompt,
        selectedVideos,
        voiceId,
        captionConfig,
        outputLanguage,
      } = payload;

      // Step 1: Generate and review script with timeout
      const { scriptId: generatedScriptId, reviewedScript } =
        await this.withTimeout(
          this.generateAndSaveScript(
            prompt,
            systemPrompt,
            editorialProfile,
            outputLanguage,
            requestId
          ),
          VideoGeneratorService.SCRIPT_GENERATION_TIMEOUT,
          'Script generation timed out'
        );
      scriptId = generatedScriptId;

      // Step 2: Fetch and validate videos
      const videosObj = await this.withTimeout(
        this.fetchAndValidateVideos(selectedVideos),
        VideoGeneratorService.DATABASE_OPERATION_TIMEOUT,
        'Video validation timed out'
      );

      // Step 3: Generate Creatomate template
      const template = await this.withTimeout(
        this.generateTemplate(
          reviewedScript,
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
        reviewedScript,
        template,
        requestId
      ).catch((error) => console.warn('Training data storage failed:', error));

      // Step 5: Start Creatomate render
      const renderId = await this.withTimeout(
        this.startCreatomateRender(template, requestId, scriptId, prompt),
        VideoGeneratorService.CREATOMATE_API_TIMEOUT,
        'Creatomate render start timed out'
      );

      // Step 6: Update video request with completion
      await this.updateVideoRequestWithResults(requestId, {
        status: 'completed',
        scriptId,
        renderId,
        script: reviewedScript,
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
        'failed',
        error instanceof Error
          ? error.message
          : 'Unknown error during processing'
      );

      // Attempt cleanup on failure
      await this.cleanupOnFailure(scriptId, requestId);
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
      const { data, error } = await supabase
        .from('video_requests')
        .insert({
          user_id: this.user.id,
          status: 'queued',
          payload: payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
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
    status: 'queued' | 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'processing') {
        updateData.processing_started_at = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else if (status === 'failed' && errorMessage) {
        updateData.error_message = errorMessage;
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
      status: string;
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
          status: results.status,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          result_data: {
            scriptId: results.scriptId,
            renderId: results.renderId,
            script: results.script,
            template: results.template,
          },
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
    // TODO: Implement script generation logic from original
    // This would use ScriptGenerator and ScriptReviewer
    console.log('🔄 Generating script...');

    // For now, return placeholder
    return {
      scriptId: `script_${Date.now()}`,
      reviewedScript: 'Generated script placeholder',
    };
  }

  private async fetchAndValidateVideos(
    selectedVideos: any[]
  ): Promise<ValidatedVideo[]> {
    // TODO: Implement video fetching and validation
    console.log('🔄 Fetching and validating videos...');
    return [];
  }

  private async generateTemplate(
    script: string,
    selectedVideos: ValidatedVideo[],
    voiceId: string,
    editorialProfile: EditorialProfile,
    captionConfig?: any,
    outputLanguage?: string
  ): Promise<any> {
    // TODO: Implement Creatomate template generation
    console.log('🔄 Generating Creatomate template...');
    return {};
  }

  private async storeTrainingDataAsync(
    prompt: string,
    script: string,
    template: any,
    videoRequestId: string
  ): Promise<void> {
    // TODO: Implement training data storage
    console.log('🔄 Storing training data...');
  }

  private async startCreatomateRender(
    template: any,
    requestId: string,
    scriptId: string,
    prompt: string
  ): Promise<string> {
    // TODO: Implement Creatomate render start
    console.log('🔄 Starting Creatomate render...');
    return `render_${Date.now()}`;
  }

  private async cleanupOnFailure(
    scriptId: string | null,
    videoRequestId: string | null
  ): Promise<void> {
    console.log('🧹 Cleaning up after failure...');
    // TODO: Implement cleanup logic
  }
}
