// Agent-related type definitions

export interface EditorialProfile {
  persona_description: string;
  tone_of_voice: string;
  audience: string;
  style_notes: string;
  examples?: string;
}

export interface ScriptGenerationRequest {
  prompt: string;
  editorialProfile: EditorialProfile;
  systemPrompt: string;
}

export interface ScriptReviewRequest {
  script: string;
  editorialProfile: EditorialProfile;
  userSystemPrompt: string;
}

export interface ScriptGenerationResponse {
  script: string;
  estimatedDuration: number;
  wordCount: number;
}

export interface ScriptReviewResponse {
  reviewedScript: string;
  estimatedDuration: number;
  wordCount: number;
  warnings?: string[];
}

export interface AgentConfig {
  model: string;
  maxTokens?: number;
  temperature?: number;
}
