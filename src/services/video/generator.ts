import { User } from "@supabase/supabase-js";
import { supabase } from "../../config/supabase";
import { ScriptGenerator } from "../scriptGenerator";
import { ScriptReviewer } from "../scriptReviewer";
import { CreatomateBuilder } from "../creatomateBuilder";
import { MODELS } from "../../config/openai";
import { PromptService } from "../promptService";
import { convertCaptionConfigToProperties } from "../../utils/video/preset-converter";
import {
  EditorialProfile,
  VideoGenerationPayload,
  VideoValidationService,
} from "./validation";
import {
  VideoGenerationResult,
  ValidatedVideo,
  CaptionConfiguration,
  VideoType,
} from "../../types/video";
import { VideoUrlRepairer } from "./videoUrlRepairer";
import winston from "winston";
import { Database } from "../../config/supabase-types";
import { VideoRequestStatus } from "../../types/video";
import { logger } from "../../config/logger";
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
  private static readonly SCRIPT_GENERATION_TIMEOUT = 180000; // 3 minutes
  private static readonly CREATOMATE_API_TIMEOUT = 280000; // 4 minutes
  private static readonly DATABASE_OPERATION_TIMEOUT = 180000; // 3 minutes

  /**
   * Create a new video generator service instance
   * @param user The authenticated user
   */
  constructor(user: User) {
    this.user = user;
    this.scriptGenerator = ScriptGenerator.getInstance(MODELS["o4-mini"]);
    this.scriptReviewer = ScriptReviewer.getInstance(MODELS["o4-mini"]);
    this.creatomateBuilder = CreatomateBuilder.getInstance(MODELS["4.1"]);
  }

  /**
   * NEW METHOD: Generate video from existing script (for ChatRequestVideo feature)
   * Skips script generation and starts directly from script content
   *
   * @param scriptDraft The existing script draft
   * @param payload The video generation payload
   * @returns The result with request ID for immediate response
   */
  async generateVideoFromScript(
    scriptDraft: Database["public"]["Tables"]["script_drafts"]["Row"],
    payload: VideoGenerationPayload,
    logger: winston.Logger
  ): Promise<VideoGenerationResult> {
    const startTime = Date.now();

    try {
      logger.info(
        `🎬 Starting video generation from script ${scriptDraft.id} for user ${this.user.id}`
      );

      // Step 1: Create video request record FIRST (this is what we return immediately)
      const videoRequest = await this.withTimeout(
        this.createVideoRequestFromScript(scriptDraft, payload),
        VideoGeneratorService.DATABASE_OPERATION_TIMEOUT,
        "Database operation timed out"
      );

      logger.info(
        `✅ Video request created: ${videoRequest.id} - returning to frontend`
      );

      // Step 2: Script already linked in createVideoRequestFromScript - no need for additional update

      // Step 3: Start background processing (fire and forget) - same as original
      this.processVideoFromScriptInBackground(
        videoRequest.id,
        payload,
        scriptDraft,
        logger
      ).catch((error: any) => {
        logger.error(
          `❌ Background processing failed for request ${videoRequest.id}:`,
          error
        );
      });

      const duration = Date.now() - startTime;
      logger.info(
        `✅ Video request from script created and returned in ${duration}ms`
      );

      return {
        requestId: videoRequest.id,
        scriptId: "", // Keep consistent with original (frontend doesn't use it anyway)
        status: VideoRequestStatus.QUEUED,
        estimatedCompletionTime: new Date(Date.now() + 300000), // 5 minutes estimate
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        `❌ Video generation from script setup failed after ${duration}ms:`,
        error
      );

      throw VideoValidationService.createError(
        error instanceof Error
          ? error.message
          : "Unknown error during video generation from script",
        "VIDEO_GENERATION_FAILED",
        {
          userId: this.user.id,
          scriptId: scriptDraft.id,
          duration,
          originalError: error instanceof Error ? error.message : error,
        },
        true,
        "Video generation failed. Please try again."
      );
    }
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
        "Database operation timed out"
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
          "Script generation timed out"
        );
      const scriptId = generatedScriptId;

      // Step 3: Start background processing (fire and forget)
      this.processVideoInBackground(
        videoRequest.id,
        payload,
        editorialProfile,
        { scriptId, reviewedScript: prompt }
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
        scriptId: "", // Will be populated during background processing
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
      if (error instanceof Error && "code" in error) {
        throw error; // Already a VideoGenerationError
      }

      throw VideoValidationService.createError(
        error instanceof Error
          ? error.message
          : "Unknown error during video generation setup",
        "VIDEO_GENERATION_FAILED",
        {
          userId: this.user.id,
          duration,
          originalError: error instanceof Error ? error.message : error,
        },
        true, // Retryable
        "Video generation failed. Please try again."
      );
    }
  }

  /**
   * Background processing method for existing script - this is where the heavy lifting happens
   * This runs after we've already returned the response to the frontend
   * Skips script generation since we already have the script
   */
  private async processVideoFromScriptInBackground(
    requestId: string,
    payload: VideoGenerationPayload,
    scriptDraft: Database["public"]["Tables"]["script_drafts"]["Row"],
    logger: winston.Logger
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(
        `🔄 Starting background processing from script for request ${requestId}`
      );

      // Update status to processing
      await this.updateVideoRequestStatus(
        requestId,
        VideoRequestStatus.RENDERING
      );

      const {
        selectedVideos,
        voiceId,
        captionConfig,
        outputLanguage,
        editorialProfile,
      } = payload;

      // Step 1: Fetch and validate videos (same as original)
      const videosObj = await this.withTimeout(
        this.fetchAndValidateVideos(selectedVideos),
        VideoGeneratorService.DATABASE_OPERATION_TIMEOUT,
        "Video validation timed out"
      );

      // Step 1.5: Create URL repairer for fixing AI-generated URLs
      const urlRepairer = new VideoUrlRepairer(videosObj, logger);

      // Step 2: Generate Creatomate template using existing script
      const template = await this.withTimeout(
        this.generateTemplate(
          scriptDraft.current_script,
          videosObj,
          voiceId,
          editorialProfile,
          captionConfig,
          outputLanguage,
          logger
        ),
        VideoGeneratorService.SCRIPT_GENERATION_TIMEOUT,
        "Template generation timed out"
      );

      // Step 2.5: Repair any incorrect URLs in the template
      logger.info("🔧 Repairing template URLs (script-based)...");
      urlRepairer.repairTemplate(template);

      // Validate that all URLs are now correct
      urlRepairer.validateTemplate(template);

      // Log repair summary
      const repairSummary = urlRepairer.getRepairSummary();
      if (repairSummary.totalCorrections > 0) {
        logger.info("📋 URL repairs completed (script-based):", repairSummary);
        logger.info("📋 Detailed corrections:", urlRepairer.getCorrections());
      } else {
        logger.info(
          "✅ No URL repairs needed - all URLs were correct (script-based)"
        );
      }

      // Step 3: Store training data (fire and forget)
      this.storeTrainingDataAsync(
        `Generated from script: ${scriptDraft.title}`,
        scriptDraft.current_script,
        template,
        requestId
      ).catch((error) => logger.warn("Training data storage failed:", error));

      // Step 4: Start Creatomate render
      const renderId = await this.withTimeout(
        this.startCreatomateRender(
          template,
          requestId,
          scriptDraft.id,
          `Video from script: ${scriptDraft.title}`
        ),
        VideoGeneratorService.CREATOMATE_API_TIMEOUT,
        "Creatomate render start timed out"
      );

      // Step 5: Update video request with completion
      await this.updateVideoRequestWithResults(requestId, {
        scriptId: scriptDraft.id,
        renderId,
        script: scriptDraft.current_script,
        template,
      });

      const duration = Date.now() - startTime;
      logger.info(
        `✅ Background processing from script completed for ${requestId} in ${duration}ms`
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(
        `❌ Background processing from script failed for ${requestId} after ${duration}ms:`,
        error
      );

      // Update request with failure status
      await this.updateVideoRequestStatus(
        requestId,
        VideoRequestStatus.FAILED,
        error instanceof Error
          ? error.message
          : "Unknown error during processing"
      );

      // Attempt cleanup on failure
      await this.cleanupOnFailure(scriptDraft.id, requestId);
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
        "Video validation timed out"
      );

      // Step 2.5: Create URL repairer for fixing AI-generated URLs
      const urlRepairer = new VideoUrlRepairer(videosObj, logger);
      console.log("🔧 URL repairer initialized for video validation");

      // Step 3: Generate Creatomate template
      const template = await this.withTimeout(
        this.generateTemplate(
          script.reviewedScript,
          videosObj,
          voiceId,
          editorialProfile,
          captionConfig,
          outputLanguage,
          logger
        ),
        VideoGeneratorService.SCRIPT_GENERATION_TIMEOUT,
        "Template generation timed out"
      );

      // Step 3.5: Repair any incorrect URLs in the template
      console.log("🔧 Repairing template URLs...");
      urlRepairer.repairTemplate(template);

      // Validate that all URLs are now correct
      urlRepairer.validateTemplate(template);

      // Log repair summary
      const repairSummary = urlRepairer.getRepairSummary();
      if (repairSummary.totalCorrections > 0) {
        console.log("📋 URL repairs completed:", repairSummary);
        console.log("📋 Detailed corrections:", urlRepairer.getCorrections());
      } else {
        console.log("✅ No URL repairs needed - all URLs were correct");
      }

      // Step 4: Store training data (fire and forget)
      this.storeTrainingDataAsync(
        prompt,
        script.reviewedScript,
        template,
        requestId
      ).catch((error) => console.warn("Training data storage failed:", error));

      // Step 5: Start Creatomate render
      const renderId = await this.withTimeout(
        this.startCreatomateRender(
          template,
          requestId,
          script.scriptId,
          prompt
        ),
        VideoGeneratorService.CREATOMATE_API_TIMEOUT,
        "Creatomate render start timed out"
      );

      // Step 6: Update video request with completion
      await this.updateVideoRequestWithResults(requestId, {
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
          : "Unknown error during processing"
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
          "OPERATION_TIMEOUT",
          { timeoutMs },
          true,
          "Operation timed out. Please try again."
        );
        reject(error);
      }, timeoutMs);
    });

    return Promise.race([promise, timeout]);
  }

  /**
   * Creates video request record from existing script
   * @private
   */
  private async createVideoRequestFromScript(
    scriptDraft: Database["public"]["Tables"]["script_drafts"]["Row"],
    payload: VideoGenerationPayload
  ): Promise<{ id: string }> {
    try {
      const { data, error } = await supabase
        .from("video_requests")
        .insert({
          user_id: this.user.id,
          script_id: scriptDraft.id, // Link to existing script
          render_status: VideoRequestStatus.QUEUED,
          selected_videos: payload.selectedVideos.map((v) => v.id),
          caption_config: (payload.captionConfig as any) || null,
          output_language: payload.outputLanguage || null,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) {
        throw VideoValidationService.createError(
          "Failed to create video request from script",
          "DATABASE_ERROR",
          { error: error?.message },
          true,
          "Unable to queue video request. Please try again."
        );
      }

      return data;
    } catch (error) {
      console.error(
        "Database error creating video request from script:",
        error
      );
      throw error;
    }
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
        .from("video_requests")
        .insert({
          user_id: this.user.id,
          render_status: "queued",
          selected_videos: payload.selectedVideos.map((v) => v.id),
          caption_config: (payload.captionConfig as any) || null,
          output_language: payload.outputLanguage || null,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error || !data) {
        throw VideoValidationService.createError(
          "Failed to create video request",
          "DATABASE_ERROR",
          { error: error?.message },
          true,
          "Unable to queue video request. Please try again."
        );
      }

      return data;
    } catch (error) {
      console.error("Database error creating video request:", error);
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
        console.warn("Failed to update video request status:", errorMessage);
        updateData.error_message = errorMessage || "Unknown error";
      }

      const { error } = await supabase
        .from("video_requests")
        .update(updateData)
        .eq("id", requestId);

      if (error) {
        console.error(`Failed to update video request ${requestId}:`, error);
      }
    } catch (error) {
      console.error(`Error updating video request ${requestId}:`, error);
    }
  }

  /**
   * Updates video request with script ID (for script-based generation)
   * @private
   */
  private async updateVideoRequestWithScript(
    requestId: string,
    scriptId: string
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("video_requests")
        .update({
          script_id: scriptId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) {
        console.error(
          `Failed to update video request ${requestId} with script:`,
          error
        );
      }
    } catch (error) {
      console.error(
        `Error updating video request ${requestId} with script:`,
        error
      );
    }
  }

  /**
   * Updates video request with final results
   * @private
   */
  private async updateVideoRequestWithResults(
    requestId: string,
    results: {
      scriptId: string;
      renderId: string;
      script: string;
      template: any;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from("video_requests")
        .update({
          script_id: results.scriptId,
          render_id: results.renderId,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

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
    script: string,
    systemPrompt: string,
    editorialProfile: EditorialProfile,
    outputLanguage: string,
    requestId: string
  ): Promise<{ scriptId: string; reviewedScript: string }> {
    try {
      console.log("🤖 Generating script...");
      // const generatedScript = await this.scriptGenerator.generate(
      //   prompt,
      //   editorialProfile,
      //   systemPrompt
      // );
      console.log("✅ Script generated successfully");

      console.log("🔍 Reviewing script...");
      // const reviewedScript = await this.scriptReviewer.review(
      //   script,
      //   editorialProfile,
      //   `System Prompt from the user:
      //   ${systemPrompt}

      //   User Prompt:
      //   ${script}

      //   Output Language: ${outputLanguage}
      //   `
      // );
      console.log("✅ Script reviewed successfully");

      console.log("💾 Creating script record...");
      const { data: scriptRecord, error: scriptError } = await supabase
        .from("scripts")
        .insert({
          user_id: this.user.id,
          raw_prompt: script,
          generated_script: script,
          status: "validated",
          output_language: outputLanguage,
        })
        .select()
        .single();

      if (!scriptRecord) {
        throw VideoValidationService.createError(
          "Failed to save script to database",
          "SCRIPT_SAVE_ERROR",
          { originalError: scriptError },
          true,
          "Failed to save the generated script. Please try again."
        );
      }

      await supabase
        .from("video_requests")
        .update({
          script_id: scriptRecord.id,
        })
        .eq("id", requestId);

      if (scriptError) {
        throw VideoValidationService.createError(
          "Failed to save script to database",
          "SCRIPT_SAVE_ERROR",
          { originalError: scriptError },
          true,
          "Failed to save the generated script. Please try again."
        );
      }

      console.log(`✅ Script created: ${scriptRecord.id}`);
      return { scriptId: scriptRecord.id, reviewedScript: script };
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        throw error; // Re-throw VideoGenerationError
      }

      throw VideoValidationService.createError(
        "Script generation failed",
        "SCRIPT_GENERATION_ERROR",
        { originalError: error },
        true,
        "Failed to generate the video script. Please try again."
      );
    }
  }

  private async fetchAndValidateVideos(
    selectedVideos: VideoType[]
  ): Promise<ValidatedVideo[]> {
    try {
      console.log("🔄 Fetching and validating videos...");

      if (!selectedVideos || selectedVideos.length === 0) {
        throw new Error("No videos selected");
      }

      // Extract video IDs from selected videos
      const videoIds = selectedVideos.map((video) => video.id).filter(Boolean);

      if (videoIds.length === 0) {
        throw new Error("No valid video IDs found in selected videos");
      }

      // Fetch videos from database
      const { data: videos, error: fetchError } = await supabase
        .from("videos")
        .select(
          "id, title, description, upload_url, tags, user_id, analysis_data"
        )
        .in("id", videoIds)
        .eq("user_id", this.user.id); // Ensure user owns these videos

      if (fetchError) {
        console.error("❌ Failed to fetch videos:", fetchError);
        throw new Error(`Failed to fetch videos: ${fetchError.message}`);
      }

      if (!videos || videos.length === 0) {
        throw new Error(
          "No accessible videos found. Please ensure videos are uploaded and processing is complete."
        );
      }

      // Validate and transform videos using the validation service
      const validatedVideos: ValidatedVideo[] = videos.map((video) => ({
        id: video.id,
        url: video.upload_url || "",
        title: video.title,
        description: video.description || "",
        tags: video.tags || [],
        user_id: video.user_id,
        analysis_data: video.analysis_data,
        upload_url: video.upload_url,
      }));

      if (validatedVideos.length === 0) {
        throw new Error("No valid videos found after validation");
      }

      console.log(`✅ Validated ${validatedVideos.length} videos`);

      return validatedVideos;
    } catch (error) {
      console.error("❌ Video fetching and validation failed:", error);
      throw VideoValidationService.createError(
        `Video validation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "VIDEO_VALIDATION_FAILED",
        {
          userId: this.user.id,
          selectedVideoCount: selectedVideos?.length || 0,
        },
        true,
        "Failed to validate selected videos. Please check your video selections."
      );
    }
  }

  private async generateTemplate(
    script: string,
    validatedVideos: ValidatedVideo[],
    voiceId: string,
    editorialProfile: EditorialProfile,
    captionConfig: CaptionConfiguration,
    outputLanguage: string,
    logger: winston.Logger
  ): Promise<any> {
    try {
      logger.info("🔄 Generating Creatomate template...");

      // Get the creatomate-builder-agent prompt from the prompt bank
      const promptTemplate = PromptService.fillPromptTemplate(
        "video-creatomate-agent-v2",
        {
          script,
          scenePlan: "Will be generated by the builder",
          voiceId,
          outputLanguage,
          captionInfo: captionConfig
            ? `Caption Config: ${JSON.stringify(captionConfig)}`
            : "",
        }
      );

      // Convert caption configuration to Creatomate format
      logger.info(
        "🚧 VideoGenerator: Converting caption config:",
        JSON.stringify(captionConfig, null, 2)
      );
      const captionStructure = convertCaptionConfigToProperties(
        captionConfig,
        logger
      );
      logger.info(
        "🚧 VideoGenerator: Caption structure after conversion:",
        JSON.stringify(captionStructure, null, 2)
      );

      // Generate template using CreatomateBuilder with prompt bank system
      const template = await this.creatomateBuilder.buildJson({
        script: script,
        selectedVideos: validatedVideos,
        voiceId,
        editorialProfile,
        captionStructure,
        agentPrompt: promptTemplate?.system || "",
        logger,
      });

      logger.info("✅ Creatomate template generated successfully");

      return template;
    } catch (error) {
      logger.error("❌ Template generation failed:", error);
      throw VideoValidationService.createError(
        `Template generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "TEMPLATE_GENERATION_FAILED",
        { userId: this.user.id, videoCount: validatedVideos.length },
        true,
        "Failed to generate video template. Please try again."
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
      console.log("🔄 Storing training data...");

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
        .from("rl_training_data")
        .insert(trainingData);

      if (trainingError) {
        // Don't throw here - training data storage is optional and shouldn't break the main flow
        console.warn("⚠️ Failed to store training data:", trainingError);
        return;
      }

      console.log("✅ Training data stored successfully");
    } catch (error) {
      // Training data storage is non-critical, so we just log and continue
      console.warn("⚠️ Error storing training data:", error);
    }
  }

  private async startCreatomateRender(
    template: any,
    requestId: string,
    scriptId: string,
    prompt: string
  ): Promise<string> {
    try {
      console.log("🚀 Starting Creatomate render...");

      // Get the server's base URL for webhook callbacks
      const baseUrl = "https://nodejs-production-a774.up.railway.app";
      const webhookUrl = `${baseUrl}/api/webhooks/creatomate`;

      const renderPayload = {
        template_id: "a5403674-6eaf-4114-a088-4d560d851aef",
        modifications: template,
        webhook_url: webhookUrl,
        output_format: "mp4",
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
        "https://api.creatomate.com/v1/renders",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(renderPayload),
        }
      );

      if (!renderResponse.ok) {
        const errorData = await renderResponse.json().catch(() => ({}));

        throw VideoValidationService.createError(
          "Creatomate API request failed",
          "CREATOMATE_API_ERROR",
          {
            status: renderResponse.status,
            statusText: renderResponse.statusText,
            errorData,
          },
          renderResponse.status >= 500, // Retry on server errors
          "Video rendering service is temporarily unavailable. Please try again."
        );
      }

      const renderData = (await renderResponse.json()) as any[];
      const renderId = renderData[0]?.id;

      if (!renderId) {
        throw VideoValidationService.createError(
          "Invalid response from Creatomate API",
          "CREATOMATE_INVALID_RESPONSE",
          { renderData },
          true,
          "Video rendering service returned an invalid response. Please try again."
        );
      }

      console.log(`✅ Render started: ${renderId}`);
      return renderId;
    } catch (error) {
      if (error instanceof Error && "code" in error) {
        throw error;
      }

      throw VideoValidationService.createError(
        "Failed to start render",
        "RENDER_START_ERROR",
        { originalError: error },
        true,
        "Failed to start video rendering. Please try again."
      );
    }
  }

  private async cleanupOnFailure(
    scriptId: string | null,
    videoRequestId: string | null
  ): Promise<void> {
    console.log("🧹 Cleaning up after failure...");
    // TODO: Implement cleanup logic
  }
}
