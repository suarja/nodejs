// Video generation types

import z from "zod";
import { Database } from "../config/supabase-types";
import {
  CaptionConfiguration as CoreCaptionConfiguration,
  VideoEditorialProfile as CoreEditorialProfile,
  VideoType as CoreVideoType,
  VideoRequestStatus as CoreVideoRequestStatus,
  VideoGenerationRequest as CoreVideoGenerationRequest,
  CaptionConfigurationSchema as CoreCaptionConfigurationSchema,
  VideoEditorialProfileSchema as CoreEditorialProfileSchema,
  validateCaptionConfig,
  validateVideoEditorialProfile,
  isValidVideo as isValidCoreVideo,
} from "editia-core";

// Re-export core types for backward compatibility
export type CaptionConfiguration = CoreCaptionConfiguration;
export type EditorialProfile = CoreEditorialProfile;
// Extend VideoType to include server-specific fields but maintain base compatibility  
export interface VideoType extends Omit<CoreVideoType, 'created_at' | 'updated_at' | 'id' | 'user_id' | 'upload_url'> {
  id: string; // Server uses plain string IDs
  user_id: string | null; // Server allows null user_id from database
  upload_url: string | null; // Server allows null upload_url from database
  analysis_data?: any; // Server-specific analysis data
  analysis_status?: CoreVideoRequestStatus;
  created_at?: string;
  updated_at?: string;
}
export const CaptionConfigurationSchema = CoreCaptionConfigurationSchema;
export const EditorialProfileSchema = CoreEditorialProfileSchema;

// Server-specific scene planning types
export const ScenePlanSchema = z.object({
  scenes: z.array(
    z.object({
      scene_number: z.number(),
      script_text: z.string(),
      video_asset: z.object({
        id: z.string(),
        url: z.string(),
        title: z.string(),
        trim_start: z.union([z.string(), z.null()]).optional(),
        trim_duration: z.union([z.string(), z.null()]).optional(),
      }),
      reasoning: z.string(),
    })
  ),
});

export type ScenePlan = z.infer<typeof ScenePlanSchema>;

// Type definitions for color constraints
export type HexColor = `#${string}`;

// Enhanced transcript effects supported by Creatomate
// export type TranscriptEffect =
//   | "karaoke"
//   | "highlight"
//   | "fade"
//   | "bounce"
//   | "slide"
//   | "enlarge";

// // Caption configuration interface
// export interface CaptionConfiguration {
//   enabled: boolean; // Toggle control for enabling/disabling captions
//   presetId?: string; // Preset identifier (karaoke, beasty, etc.)
//   placement: "top" | "center" | "bottom"; // Position on screen
//   transcriptColor?: HexColor; // Custom color override for transcript_color
//   transcriptEffect?: TranscriptEffect; // Custom effect override for transcript_effect
// }

// Enhanced types for better validation  
export type ValidatedVideo = VideoType;

// Re-export VideoRequestStatus with mapping for server-specific values
export const VideoRequestStatus = {
  QUEUED: CoreVideoRequestStatus.QUEUED,
  RENDERING: CoreVideoRequestStatus.PROCESSING,
  DONE: CoreVideoRequestStatus.COMPLETED,
  ERROR: CoreVideoRequestStatus.FAILED,
} as const;

export type VideoRequestStatus = CoreVideoRequestStatus;

// Server-specific video generation request extending core type
export interface VideoGenerationRequest extends Omit<CoreVideoGenerationRequest, 'userId' | 'scriptId' | 'selectedVideoIds'> {
  systemPrompt: string;
  selectedVideos: VideoType[];
  voiceId: string;
}

// export interface EditorialProfile {
//   persona_description: string;
//   tone_of_voice: string;
//   audience: string;
//   style_notes: string;
//   examples?: string;
// }

export interface VideoGenerationResult {
  requestId: string;
  scriptId: string;
  renderId?: string;
  status: VideoRequestStatus;
  estimatedCompletionTime?: Date;
}

export interface VideoGenerationError extends Error {
  code: string;
  context?: Record<string, any>;
  retryable: boolean;
  userMessage: string;
}

// Type guards for runtime validation
export function isValidVideo(video: any): video is VideoType {
  return (
    isValidCoreVideo(video) &&
    (video.analysis_data === undefined || video.analysis_data === null || typeof video.analysis_data === "object")
  );
}

// Re-export validation functions from core
export function isValidCaptionConfig(
  config: any
): config is CaptionConfiguration {
  return validateCaptionConfig(config);
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(color);
}

export function isValidEditorialProfile(
  profile: any
): profile is EditorialProfile {
  return validateVideoEditorialProfile(profile);
}

// Server-side specific types for queue management
export interface VideoRequest {
  id: string;
  user_id: string;
  status: VideoRequestStatus;
  payload: VideoGenerationRequest;
  queue_position?: number;
  processing_started_at?: Date;
  completed_at?: Date;
  error_message?: string;
  result_data?: any;
  created_at: Date;
  updated_at: Date;
}

export interface VideoStatusResponse {
  id: string;
  status: VideoRequestStatus;
  queuePosition?: number;
  estimatedWaitTime?: string;
  progress?: number;
  error?: string;
  result?: {
    videoUrl?: string;
    script?: string;
    renderUrl?: string;
  };
}

// S3 Upload types
export interface S3UploadRequest {
  fileName: string;
  fileType: string;
}

export interface S3UploadResponse {
  presignedUrl: string;
  publicUrl: string;
  fileName: string;
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
