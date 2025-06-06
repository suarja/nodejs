// Video generation types

export interface VideoGenerationRequest {
  prompt: string;
  systemPrompt?: string;
  videoUrl?: string;
  videoLanguage?: string;
  captionPlacement?: 'top' | 'middle' | 'bottom';
  captionLines?: 1 | 3;
  userId: string;
}

export interface VideoGenerationResponse {
  requestId: string;
  scriptId?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  queuePosition?: number;
  estimatedWaitTime?: string;
}

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
