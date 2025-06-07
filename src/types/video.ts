// Video generation types

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
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface CaptionConfiguration {
  presetId: string;
  placement: 'top' | 'bottom' | 'center';
  lines: number;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  animation?: string;
  effect?: string;
  highlightColor?: string;
  maxWordsPerLine?: number;
}

// Enhanced types for better validation
export interface ValidatedVideo {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
}

export interface VideoGenerationRequest {
  prompt: string;
  systemPrompt: string;
  selectedVideos: VideoType[];
  editorialProfile: EditorialProfile;
  voiceId: string;
  captionConfig?: CaptionConfiguration;
  outputLanguage: string;
}

export interface EditorialProfile {
  persona_description: string;
  tone_of_voice: string;
  audience: string;
  style_notes: string;
  examples?: string;
}

export interface VideoGenerationResult {
  requestId: string;
  scriptId: string;
  renderId?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
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
    typeof video === 'object' &&
    video !== null &&
    typeof video.id === 'string' &&
    typeof video.upload_url === 'string' &&
    typeof video.title === 'string' &&
    Array.isArray(video.tags)
  );
}

export function isValidCaptionConfig(
  config: any
): config is CaptionConfiguration {
  return (
    typeof config === 'object' &&
    config !== null &&
    typeof config.presetId === 'string' &&
    ['top', 'bottom', 'center'].includes(config.placement)
  );
}

export function isValidHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{6})$/.test(color);
}

export function isValidEditorialProfile(
  profile: any
): profile is EditorialProfile {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    typeof profile.persona_description === 'string' &&
    typeof profile.tone_of_voice === 'string' &&
    typeof profile.audience === 'string' &&
    typeof profile.style_notes === 'string'
  );
}

// Server-side specific types for queue management
export interface VideoRequest {
  id: string;
  user_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
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
  status: 'queued' | 'processing' | 'completed' | 'failed';
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
