import {
  VideoType,
  CaptionConfiguration,
  EditorialProfile as VideoEditorialProfile,
  VideoGenerationRequest,
  ValidatedVideo,
  VideoGenerationError,
  isValidVideo,
  isValidCaptionConfig,
  isValidEditorialProfile,
} from '../../types/video';

// Export EditorialProfile for use in other services
export type EditorialProfile = VideoEditorialProfile;
import { errorResponseExpress, HttpStatus } from '../../utils/api/responses';

/**
 * Enhanced validation result with better error handling
 */
export type ValidationResult =
  | { success: true; payload: VideoGenerationRequest }
  | { success: false; error: any; details?: ValidationErrorDetails };

/**
 * Detailed validation error information
 */
export interface ValidationErrorDetails {
  field: string;
  code: string;
  message: string;
  value?: any;
}

/**
 * Video generation payload type (for backward compatibility)
 */
export type VideoGenerationPayload = VideoGenerationRequest;

/**
 * Enhanced validation service with comprehensive error handling
 */
export class VideoValidationService {
  private static readonly REQUIRED_FIELDS = [
    'prompt',
    'selectedVideos',
    'outputLanguage',
  ] as const;

  private static readonly MAX_PROMPT_LENGTH = 2000;
  private static readonly MAX_SYSTEM_PROMPT_LENGTH = 2000;
  private static readonly MIN_VIDEOS = 1;
  private static readonly MAX_VIDEOS = 10;

  /**
   * Validates the video generation request body with comprehensive error handling
   * @param body The request body to validate
   * @returns ValidationResult with either the validated payload or detailed error
   */
  static validateRequest(body: any): ValidationResult {
    try {
      const errors: ValidationErrorDetails[] = [];

      // Validate required fields
      const missingFields = this.validateRequiredFields(body);
      errors.push(...missingFields);

      // Validate individual fields
      if (body.prompt) {
        const promptErrors = this.validatePrompt(body.prompt);
        errors.push(...promptErrors);
      }

      if (body.systemPrompt) {
        const systemPromptErrors = this.validateSystemPrompt(body.systemPrompt);
        errors.push(...systemPromptErrors);
      }

      if (body.selectedVideos) {
        const videoErrors = this.validateSelectedVideos(body.selectedVideos);
        errors.push(...videoErrors);
      }

      if (body.editorialProfile) {
        const profileErrors = this.validateEditorialProfile(
          body.editorialProfile
        );
        errors.push(...profileErrors);
      }

      if (body.captionConfig) {
        const captionErrors = this.validateCaptionConfig(body.captionConfig);
        errors.push(...captionErrors);
      }

      if (body.outputLanguage) {
        const languageErrors = this.validateOutputLanguage(body.outputLanguage);
        errors.push(...languageErrors);
      }

      if (body.voiceId) {
        const voiceErrors = this.validateVoiceId(body.voiceId);
        errors.push(...voiceErrors);
      }

      // If there are validation errors, return them
      if (errors.length > 0) {
        return {
          success: false,
          error: {
            message: 'Validation failed',
            status: HttpStatus.BAD_REQUEST,
            details: { errors },
          },
          details: errors.length > 0 ? errors[0] : undefined, // Return first error for compatibility
        };
      }

      // Return validated payload
      return {
        success: true,
        payload: {
          prompt: body.prompt.trim(),
          systemPrompt: body.systemPrompt?.trim() || '',
          selectedVideos: body.selectedVideos,
          editorialProfile: body.editorialProfile,
          voiceId: body.voiceId,
          captionConfig: body.captionConfig,
          outputLanguage: body.outputLanguage,
        },
      };
    } catch (error) {
      // Handle unexpected validation errors
      return {
        success: false,
        error: {
          message: 'Internal validation error',
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
        details: {
          field: 'unknown',
          code: 'VALIDATION_ERROR',
          message: 'An unexpected error occurred during validation',
        },
      };
    }
  }

  /**
   * Validates required fields
   * @private
   */
  private static validateRequiredFields(body: any): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    for (const field of this.REQUIRED_FIELDS) {
      if (!body[field]) {
        errors.push({
          field,
          code: 'REQUIRED_FIELD_MISSING',
          message: `Field '${field}' is required`,
          value: body[field],
        });
      }
    }

    return errors;
  }

  /**
   * Validates prompt field
   * @private
   */
  private static validatePrompt(prompt: any): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    if (typeof prompt !== 'string') {
      errors.push({
        field: 'prompt',
        code: 'INVALID_TYPE',
        message: 'Prompt must be a string',
        value: prompt,
      });
      return errors;
    }

    if (prompt.trim().length === 0) {
      errors.push({
        field: 'prompt',
        code: 'EMPTY_VALUE',
        message: 'Prompt cannot be empty',
        value: prompt,
      });
    }

    if (prompt.length > this.MAX_PROMPT_LENGTH) {
      errors.push({
        field: 'prompt',
        code: 'VALUE_TOO_LONG',
        message: `Prompt cannot exceed ${this.MAX_PROMPT_LENGTH} characters`,
        value: prompt,
      });
    }

    return errors;
  }

  /**
   * Validates system prompt field
   * @private
   */
  private static validateSystemPrompt(
    systemPrompt: any
  ): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    if (typeof systemPrompt !== 'string') {
      errors.push({
        field: 'systemPrompt',
        code: 'INVALID_TYPE',
        message: 'System prompt must be a string',
        value: systemPrompt,
      });
      return errors;
    }

    if (systemPrompt.length > this.MAX_SYSTEM_PROMPT_LENGTH) {
      errors.push({
        field: 'systemPrompt',
        code: 'VALUE_TOO_LONG',
        message: `System prompt cannot exceed ${this.MAX_SYSTEM_PROMPT_LENGTH} characters`,
        value: systemPrompt,
      });
    }

    return errors;
  }

  /**
   * Validates selected videos field
   * @private
   */
  private static validateSelectedVideos(
    selectedVideos: any
  ): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    if (!Array.isArray(selectedVideos)) {
      errors.push({
        field: 'selectedVideos',
        code: 'INVALID_TYPE',
        message: 'Selected videos must be an array',
        value: selectedVideos,
      });
      return errors;
    }

    if (selectedVideos.length < this.MIN_VIDEOS) {
      errors.push({
        field: 'selectedVideos',
        code: 'TOO_FEW_ITEMS',
        message: `At least ${this.MIN_VIDEOS} video must be selected`,
        value: selectedVideos,
      });
    }

    if (selectedVideos.length > this.MAX_VIDEOS) {
      errors.push({
        field: 'selectedVideos',
        code: 'TOO_MANY_ITEMS',
        message: `Cannot select more than ${this.MAX_VIDEOS} videos`,
        value: selectedVideos,
      });
    }

    // Validate each video
    selectedVideos.forEach((video, index) => {
      if (!isValidVideo(video)) {
        errors.push({
          field: `selectedVideos[${index}]`,
          code: 'INVALID_VIDEO',
          message: `Video at index ${index} is invalid`,
          value: video,
        });
      }
    });

    return errors;
  }

  /**
   * Validates editorial profile field
   * @private
   */
  private static validateEditorialProfile(
    editorialProfile: any
  ): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    if (!isValidEditorialProfile(editorialProfile)) {
      errors.push({
        field: 'editorialProfile',
        code: 'INVALID_EDITORIAL_PROFILE',
        message: 'Editorial profile is invalid',
        value: editorialProfile,
      });
    }

    return errors;
  }

  /**
   * Validates caption config field
   * @private
   */
  private static validateCaptionConfig(
    captionConfig: any
  ): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    if (!isValidCaptionConfig(captionConfig)) {
      errors.push({
        field: 'captionConfig',
        code: 'INVALID_CAPTION_CONFIG',
        message:
          'Caption configuration is invalid. Must include "enabled" boolean property.',
        value: captionConfig,
      });
    }

    return errors;
  }

  /**
   * Validates output language field
   * @private
   */
  private static validateOutputLanguage(
    outputLanguage: any
  ): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    if (typeof outputLanguage !== 'string') {
      errors.push({
        field: 'outputLanguage',
        code: 'INVALID_TYPE',
        message: 'Output language must be a string',
        value: outputLanguage,
      });
      return errors;
    }

    const supportedLanguages = [
      'en',
      'es',
      'fr',
      'de',
      'it',
      'pt',
      'ru',
      'ja',
      'ko',
      'zh',
    ];

    if (!supportedLanguages.includes(outputLanguage)) {
      errors.push({
        field: 'outputLanguage',
        code: 'UNSUPPORTED_LANGUAGE',
        message: `Language '${outputLanguage}' is not supported`,
        value: outputLanguage,
      });
    }

    return errors;
  }

  /**
   * Validates voice ID field
   * @private
   */
  private static validateVoiceId(voiceId: any): ValidationErrorDetails[] {
    const errors: ValidationErrorDetails[] = [];

    if (typeof voiceId !== 'string') {
      errors.push({
        field: 'voiceId',
        code: 'INVALID_TYPE',
        message: 'Voice ID must be a string',
        value: voiceId,
      });
      return errors;
    }

    if (voiceId.trim().length === 0) {
      errors.push({
        field: 'voiceId',
        code: 'EMPTY_VALUE',
        message: 'Voice ID cannot be empty',
        value: voiceId,
      });
    }

    return errors;
  }

  /**
   * Validates videos array
   */
  static validateVideos(videos: VideoType[]): ValidatedVideo[] {
    return videos.filter(isValidVideo).map((video) => ({
      id: video.id,
      url: video.upload_url,
      title: video.title,
      description: video.description,
      tags: video.tags,
    }));
  }

  /**
   * Creates a standardized error object
   */
  static createError(
    message: string,
    code: string,
    context?: Record<string, any>,
    retryable: boolean = false,
    userMessage?: string
  ): VideoGenerationError {
    const error = new Error(message) as VideoGenerationError;
    error.code = code;
    error.context = context;
    error.retryable = retryable;
    error.userMessage = userMessage || message;
    return error;
  }
}
