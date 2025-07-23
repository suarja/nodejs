import { VideoType, ScenePlan, CaptionConfiguration } from '../../types/video';
import { TemplateValidationResult } from 'editia-core';
import { VideoTemplateService as CoreVideoTemplateService } from 'editia-core';
import { logger } from '../../config/logger';
import winston from 'winston';
import { PromptService } from '../promptService';
import { createOpenAIClient, MODELS } from '../../config/openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ScenePlanSchema } from '../../types/video';
import OpenAI from 'openai';
import { VideoUrlRepairer } from './videoUrlRepairer';

interface DurationViolation {
  sceneIndex: number;
  textLength: number;
  videoLength: number;
  overageSeconds: number;
}

/**
 * Unified validation service for the entire video generation pipeline
 * Centralizes all validation logic in one place with clear naming
 */
export class VideoValidationService {
  private openai: OpenAI;
  private model: string;

  constructor(model: string = MODELS["4.1"]) {
    this.openai = createOpenAIClient();
    this.model = model;
  }

  /**
   * Phase 1: Input validation (before any processing)
   * Validates script, videos, and caption configuration
   */
  async validateInputConfiguration(
    scriptText: string, 
    selectedVideos: VideoType[], 
    captionConfig: CaptionConfiguration
  ): Promise<TemplateValidationResult> {
    
    // Convert server VideoType to core VideoType for validation
    const coreVideos = selectedVideos.map(video => ({
      id: video.id as any,
      title: video.title,
      description: video.description,
      upload_url: video.upload_url || '',
      tags: video.tags,
      user_id: video.user_id as any,
      duration_seconds: video.duration_seconds,
      created_at: video.created_at || new Date().toISOString(),
      updated_at: video.updated_at || new Date().toISOString()
    }));

    // Use core validation
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
   * Phase 2: Scene plan validation (after planning, before template generation)
   * Validates and repairs scene plan including durations and URLs
   */
  async validateAndRepairScenePlan(
    scenePlan: ScenePlan,
    selectedVideos: VideoType[],
    scriptText: string,
    logger: winston.Logger
  ): Promise<ScenePlan> {
    let repairedPlan = scenePlan;

    // Step 1: Duration validation with max 3 iterations
    for (let attempt = 1; attempt <= 3; attempt++) {
      logger.info(`🔍 Scene duration validation attempt ${attempt}/3`);
      
      const violations = this.validateSceneDurations(repairedPlan, selectedVideos);
      
      if (violations.length === 0) {
        logger.info(`✅ Scene duration validation passed on attempt ${attempt}`);
        break;
      }
      
      // Log violations for debugging
      logger.warn(`⚠️ Found ${violations.length} duration violations:`, {
        violations: violations.map(v => ({
          scene: v.sceneIndex,
          overage: `${v.overageSeconds.toFixed(1)}s`,
          textLength: v.textLength,
          videoLength: v.videoLength
        }))
      });
      
      if (attempt < 3) {
        // Repair durations with AI
        repairedPlan = await this.repairSceneDurationsWithAI(
          repairedPlan,
          violations,
          scriptText,
          selectedVideos,
          logger
        );
      } else {
        throw new Error(
          `Scene duration validation failed after ${attempt} attempts. ` +
          `${violations.length} scenes exceed video duration.`
        );
      }
    }

    // Step 2: URL validation
    repairedPlan = await this.validateScenePlanUrls(repairedPlan, selectedVideos, logger);

    return repairedPlan;
  }

  /**
   * Phase 3: Final template validation (after template is built)
   * Validates template structure and URLs
   */
  async validateFinalTemplate(
    template: any,
    selectedVideos: VideoType[]
  ): Promise<any> {
    // Structure validation
    this.validateTemplateStructure(template);
    
    // URL validation ONCE (no more triple repair!)
    const videoUrlRepairer = new VideoUrlRepairer(selectedVideos, logger);
    videoUrlRepairer.repairTemplate(template);
    
    return template;
  }

  /**
   * Validate scene durations using 0.7 word multiplier logic
   */
  private validateSceneDurations(scenePlan: ScenePlan, selectedVideos?: VideoType[]): DurationViolation[] {
    const violations: DurationViolation[] = [];
    
    for (let i = 0; i < scenePlan.scenes.length; i++) {
      const scene = scenePlan.scenes[i];
      
      if (!scene) {
        continue;
      }
      
      // Use same 0.7 multiplier as frontend validation
      const textWordCount = scene.script_text.split(/\s+/).filter(word => word.length > 0).length;
      const voiceoverDuration = textWordCount * 0.7;
      
      // Get video duration (use trim_duration if available, fallback to full duration)
      let videoDuration = 0;
      
      if (scene.video_asset.trim_duration) {
        videoDuration = parseFloat(scene.video_asset.trim_duration);
      } else if (selectedVideos) {
        // Find the video in selectedVideos by ID to get duration
        const video = selectedVideos.find(v => v.id === scene.video_asset.id);
        videoDuration = video?.duration_seconds || 0;
      }
      
      // Skip validation if we can't determine video duration
      if (videoDuration <= 0) {
        continue;
      }
      
      // Apply 5% safety margin
      const maxAllowedDuration = videoDuration * 0.95;
      
      if (voiceoverDuration > maxAllowedDuration) {
        violations.push({
          sceneIndex: i,
          textLength: voiceoverDuration,
          videoLength: videoDuration,
          overageSeconds: voiceoverDuration - maxAllowedDuration
        });
      }
    }
    
    return violations;
  }

  /**
   * Repair scene durations using LLM with prompt v5
   */
  private async repairSceneDurationsWithAI(
    scenePlan: ScenePlan,
    violations: DurationViolation[],
    script: string,
    selectedVideos: VideoType[],
    logger: winston.Logger
  ): Promise<ScenePlan> {
    
    // Format violation feedback for LLM
    const violationFeedback = violations.map(v => 
      `Scene ${v.sceneIndex + 1}: Text ${v.textLength.toFixed(1)}s exceeds video duration ${v.videoLength.toFixed(1)}s by ${v.overageSeconds.toFixed(1)}s`
    ).join('\n');

    // Get NEW prompt template v5
    const promptTemplate = PromptService.fillPromptTemplate(
      'video-scene-planner-v5',
      {
        script,
        selectedVideos: JSON.stringify(selectedVideos, null, 2),
        durationViolations: violationFeedback,
        scenePlan: JSON.stringify(scenePlan, null, 2)
      }
    );

    if (!promptTemplate) {
      throw new Error('Scene planner v5 prompt not found');
    }

    logger.info(`🔧 Repairing scene durations with LLM feedback:`, { 
      violations: violations.length,
      feedback: violationFeedback 
    });

    // Call LLM with duration repair instructions
    const response = await this.openai.responses.parse({
      model: this.model,
      input: [
        {
          role: "system", 
          content: promptTemplate.system,
        },
        {
          role: "user",
          content: promptTemplate.user,
        },
      ],
      text: {
        format: zodTextFormat(ScenePlanSchema, "repaired_video_plan"),
      },
    });

    if (!response.output_parsed) {
      throw new Error('Failed to repair scene plan durations');
    }

    return response.output_parsed;
  }

  /**
   * Validate scene plan URLs and ensure they match available videos
   */
  private async validateScenePlanUrls(
    scenePlan: ScenePlan, 
    selectedVideos: VideoType[],
    logger: winston.Logger
  ): Promise<ScenePlan> {
    const videoUrlRepairer = new VideoUrlRepairer(selectedVideos, logger);
    return videoUrlRepairer.validateScenePlan(scenePlan);
  }

  /**
   * Validate template structure (dimensions, required properties)
   */
  private validateTemplateStructure(template: any): void {
    // Basic structure validation
    if (
      !template.output_format ||
      !template.width ||
      !template.height ||
      !template.elements
    ) {
      throw new Error("Invalid template: Missing required properties");
    }

    // Validate dimensions for TikTok format
    if (template.width !== 1080 || template.height !== 1920) {
      throw new Error("Invalid template: Must be 1080x1920 for vertical video");
    }

    // Validate scenes
    if (!Array.isArray(template.elements)) {
      throw new Error("Invalid template: elements must be an array");
    }

    logger.info("✅ Template structure validation passed");
  }

  /**
   * Validate scene plan structure
   */
  validateScenePlan(scenePlan: ScenePlan, availableVideos: VideoType[]): string[] {
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
}

// Export singleton instance
export const videoValidationService = new VideoValidationService();