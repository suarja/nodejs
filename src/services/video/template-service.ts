import { VideoTemplateService as CoreVideoTemplateService } from 'editia-core';
import type { 
  VideoType as CoreVideoType, 
  CaptionConfiguration,
  TemplateValidationResult
} from 'editia-core';
import { CreatomateBuilder } from '../creatomateBuilder';
import { logger } from '../../config/logger';
import { ScenePlan, VideoType } from '../../types/video';
import { videoValidationService } from './validation-service';
import winston from 'winston';
import { PromptService } from '../promptService';
import { MODELS } from '../../config/openai';

/**
 * Enhanced video template service that extends core functionality
 * with server-specific features like Creatomate integration
 */
export class VideoTemplateService {
  private creatomateBuilder: CreatomateBuilder;

  constructor() {
    this.creatomateBuilder = CreatomateBuilder.getInstance(MODELS["4.1"]);
  }

  /**
   * Validates a video template with comprehensive checks
   * Uses core validation + server-specific validations
   */
  public validateTemplate(
    scriptText: string,
    selectedVideos: VideoType[],
    captionConfig: CaptionConfiguration,
    scenePlan?: ScenePlan
  ): TemplateValidationResult {
    // Convert server VideoType to core VideoType for validation
    const coreVideos: CoreVideoType[] = selectedVideos.map(video => ({
      id: video.id as any, // Cast to branded type for core validation
      title: video.title,
      description: video.description,
      upload_url: video.upload_url || '', // Handle null upload_url
      tags: video.tags,
      user_id: video.user_id as any, // Cast to branded type for core validation  
      duration_seconds: video.duration_seconds,
      created_at: video.created_at || new Date().toISOString(),
      updated_at: video.updated_at || new Date().toISOString()
    }));

    // First run core validation
    const coreValidation = CoreVideoTemplateService.validateTemplate(
      scriptText,
      coreVideos,
      captionConfig
    );

    if (!coreValidation.isValid) {
      return coreValidation;
    }

    // Additional server-specific validations
    const errors: string[] = [];

    // Validate scene plan if provided
    if (scenePlan) {
      const scenePlanErrors = this.validateScenePlan(scenePlan, selectedVideos);
      errors.push(...scenePlanErrors);
    }

    // Check for Creatomate-specific requirements
    if (selectedVideos.some(v => !v.upload_url || v.upload_url.trim() === '')) {
      errors.push('All videos must have valid upload URLs for Creatomate processing');
    }

    if (errors.length > 0) {
      return {
        isValid: false,
        errors,
        warnings: coreValidation.warnings || [],
        captionsEnabled: captionConfig.enabled,
        totalDuration: coreValidation.totalDuration,
        requiredDuration: coreValidation.requiredDuration
      };
    }

    return coreValidation;
  }

  /**
   * NEW: Main template generation method that orchestrates the entire flow
   * Replaces logic from VideoGeneratorService.generateTemplate()
   */
  public async generateTemplate(
    config: {
      scriptText: string;
      selectedVideos: VideoType[];
      captionConfig: CaptionConfiguration;
      editorialProfile: any;
      voiceId: string;
      outputLanguage: string;
      systemPrompt?: string;
      captionStructure?: any;
    }
  ): Promise<any> {
    const processLogger = logger.child({ method: 'generateTemplate' });
    
    // Step 1: Validate inputs
    const validation = await videoValidationService.validateInputConfiguration(
      config.scriptText,
      config.selectedVideos,
      config.captionConfig
    );

    if (!validation.isValid) {
      throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
    }

    processLogger.info('✅ Input validation passed');

    // Step 2: Plan video structure
    let scenePlan = await this.creatomateBuilder.planVideoStructure(
      config.scriptText,
      config.selectedVideos,
      processLogger as winston.Logger
    );

    processLogger.info('✅ Video structure planned');


    // Step 3: Validate and repair scene plan BEFORE building template
    scenePlan = await videoValidationService.validateAndRepairScenePlan(
      scenePlan,
      config.selectedVideos,
      config.scriptText,
      processLogger as winston.Logger
    );

    processLogger.info('✅ Scene plan validated and repaired');

    // Step 4: Generate template with validated scene plan
      const agentPrompt = process.env.CREATOMATE_BUILDER_AGENT_PROMPT || "video-creatomate-agent-v4";

          const promptTemplate = PromptService.fillPromptTemplate(agentPrompt, {
        script: config.scriptText,
        scenePlan,
        voiceId: config.voiceId,
        outputLanguage: config.outputLanguage,
        captionInfo: config.captionConfig ? `Caption Config: ${JSON.stringify(config.captionConfig)}` : "",
        systemPrompt: config.systemPrompt,
        selectedVideos: config.selectedVideos,
      });

      if (!promptTemplate) {
        throw new Error('Scene planner v5 prompt not found');
      }

    let template = await this.creatomateBuilder.generateTemplate({
      script: config.scriptText,
      selectedVideos: config.selectedVideos,
      voiceId: config.voiceId,
      editorialProfile: config.editorialProfile,
      scenePlan: scenePlan,
      captionStructure: config.captionStructure,
      agentPrompt: promptTemplate.system,
    });

    processLogger.info('✅ Template generated');

    // Step 5-7: Apply template fixes
    videoValidationService.patchAudioTextToSource(template);
    videoValidationService.fixTemplate(template);
    videoValidationService.handleCaptionConfiguration(template, config.captionStructure);

    processLogger.info('✅ Template fixes applied');

    // Step 8: Final template validation
    template = await videoValidationService.validateFinalTemplate(
      template,
      config.selectedVideos,
      config.voiceId
    );

    processLogger.info('✅ Final template validation passed');

    return template;
  }

  /**
   * DEPRECATED: Use generateTemplate() instead
   * Kept for backward compatibility during migration
   */
  public async buildTemplate(
    config: {
      scriptText: string;
      selectedVideos: VideoType[];
      captionConfig: CaptionConfiguration;
      editorialProfile: any;
      voiceId: string;
      outputLanguage: string;
      systemPrompt?: string;
      captionStructure?: any;
      agentPrompt?: string;
    }
  ): Promise<any> {
    // Validate the template configuration first
    const validation = this.validateTemplate(
      config.scriptText,
      config.selectedVideos,
      config.captionConfig
    );

    if (!validation.isValid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    // Log template validation success
    logger.info('Template validation successful', {
      scriptLength: config.scriptText.length,
      videoCount: config.selectedVideos.length,
      captionsEnabled: config.captionConfig.enabled,
      totalDuration: this.calculateTotalDuration(config.selectedVideos),
      warnings: validation.warnings
    });

    // DEPRECATED: This method should not be called anymore
    // Use generateTemplate() instead
    throw new Error('VideoTemplateService.buildTemplate is deprecated. Use generateTemplate() instead.');
  }

  /**
   * Validates scene plan against available videos
   */
  private validateScenePlan(scenePlan: ScenePlan, availableVideos: VideoType[]): string[] {
    const errors: string[] = [];
    const videoIds = new Set(availableVideos.map(v => v.id as string));

    for (const scene of scenePlan.scenes) {
      if (!videoIds.has(scene.video_asset.id)) {
        errors.push(`Scene ${scene.scene_number}: Video ID ${scene.video_asset.id} not found in available videos`);
      }

      // Validate trim times if provided
      if (scene.video_asset.trim_start !== null && scene.video_asset.trim_duration !== null) {
        const trimStart = parseFloat(scene.video_asset.trim_start || '0');
        const trimDuration = parseFloat(scene.video_asset.trim_duration || '0');
        
        if (isNaN(trimStart) || trimStart < 0) {
          errors.push(`Scene ${scene.scene_number}: Invalid trim_start value`);
        }
        
        if (isNaN(trimDuration) || trimDuration <= 0) {
          errors.push(`Scene ${scene.scene_number}: Invalid trim_duration value`);
        }
      }
    }

    return errors;
  }

  /**
   * Calculates total duration of videos
   */
  private calculateTotalDuration(videos: VideoType[]): number {
    return videos.reduce((total, video) => {
      return total + (video.duration_seconds || 0);
    }, 0);
  }

}

// Export singleton instance
export const videoTemplateService = new VideoTemplateService();