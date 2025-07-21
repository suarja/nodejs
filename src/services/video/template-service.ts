import { VideoTemplateService as CoreVideoTemplateService } from 'editia-core';
import type { 
  VideoType, 
  CaptionConfiguration,
  TemplateValidationResult
} from 'editia-core';
import { CreatomateBuilder } from '../creatomateBuilder';
import { logger } from '../../config/logger';
import { ScenePlan } from '../../types/video';

/**
 * Enhanced video template service that extends core functionality
 * with server-specific features like Creatomate integration
 */
export class VideoTemplateService {
  private creatomateBuilder: CreatomateBuilder;

  constructor() {
    this.creatomateBuilder = CreatomateBuilder.getInstance('gpt-4');
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
    // First run core validation
    const coreValidation = CoreVideoTemplateService.validateTemplate(
      scriptText,
      selectedVideos,
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
   * Builds a Creatomate template with validation
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

    // Build the Creatomate template using existing buildJson method
    const template = await this.creatomateBuilder.buildJson({
      script: config.scriptText,
      selectedVideos: config.selectedVideos,
      voiceId: config.voiceId,
      editorialProfile: config.editorialProfile,
      captionStructure: config.captionStructure,
      agentPrompt: config.agentPrompt || '',
      logger: logger
    });

    return template;
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

  /**
   * Prepares videos for template generation by ensuring all required fields
   */
  public prepareVideosForTemplate(videos: VideoType[]): VideoType[] {
    return videos.map(video => ({
      ...video,
      // Ensure all required fields are present
      duration_seconds: video.duration_seconds || null,
      tags: video.tags || [],
      description: video.description || ''
    }));
  }
}

// Export singleton instance
export const videoTemplateService = new VideoTemplateService();