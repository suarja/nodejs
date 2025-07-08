// Video generation types

import z from "zod";

export const CaptionConfigurationSchema = z.object({
  enabled: z.boolean(),
  presetId: z.string().optional(),
  placement: z.enum(["top", "center", "bottom"]),
  transcriptColor: z.string().optional(),
  transcriptEffect: z.string().optional(),
});

export type CaptionConfiguration = z.infer<typeof CaptionConfigurationSchema>;

export interface VideoType {
  id: string;
  title: string;
  description: string;
  upload_url: string;
  tags: string[];
  user_id: string;
  created_at: string;
  updated_at: string;
  duration?: number;
  thumbnail_url?: string;
  file_size?: number;
  processing_status?: "pending" | "processing" | "completed" | "failed";
}

export const EditorialProfileSchema = z.object({
  persona_description: z.string(),
  tone_of_voice: z.string(),
  audience: z.string(),
  style_notes: z.string(),
  examples: z.string().optional(),
});

export type EditorialProfile = z.infer<typeof EditorialProfileSchema>;

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
export interface ValidatedVideo {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
}

export enum VideoRequestStatus {
  QUEUED = "queued",
  RENDERING = "rendering",
  COMPLETED = "done",
  FAILED = "error",
}

export interface VideoGenerationRequest {
  prompt: string;
  systemPrompt: string;
  selectedVideos: VideoType[];
  editorialProfile: EditorialProfile;
  voiceId: string;
  captionConfig: CaptionConfiguration;
  outputLanguage: string;
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
    typeof video === "object" &&
    video !== null &&
    typeof video.id === "string" &&
    typeof video.upload_url === "string" &&
    typeof video.title === "string" &&
    Array.isArray(video.tags)
  );
}

// Caption config validation
export function isValidCaptionConfig(
  config: any
): config is CaptionConfiguration {
  return (
    typeof config === "object" &&
    config !== null &&
    typeof config.enabled === "boolean" &&
    (config.presetId === undefined || typeof config.presetId === "string") &&
    ["top", "center", "bottom"].includes(config.placement) &&
    (config.transcriptColor === undefined ||
      (typeof config.transcriptColor === "string" &&
        config.transcriptColor.startsWith("#"))) &&
    (config.transcriptEffect === undefined ||
      ["karaoke", "highlight", "fade", "bounce", "slide", "enlarge"].includes(
        config.transcriptEffect
      ))
  );
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(color);
}

export function isValidEditorialProfile(
  profile: any
): profile is EditorialProfile {
  return (
    typeof profile === "object" &&
    profile !== null &&
    typeof profile.persona_description === "string" &&
    typeof profile.tone_of_voice === "string" &&
    typeof profile.audience === "string" &&
    typeof profile.style_notes === "string"
  );
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
