import { z } from "zod";

// Script Chat Message Types
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  metadata?: {
    isStreaming?: boolean;
    tokensUsed?: number;
    model?: string;
    hasScriptUpdate?: boolean;
    scriptStatus?: string;
  };
}

// Script Draft with Conversation History
export interface ScriptDraft {
  id: string;
  title: string;
  status: "draft" | "validated" | "used";
  current_script: string;
  messages: ChatMessage[];
  output_language: string;
  editorial_profile_id?: string;
  word_count: number;
  estimated_duration: number;
  message_count: number;
  version: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

// Chat Request/Response Types
export interface ScriptChatRequest {
  scriptId?: string; // Optional: for continuing existing conversation
  message: string;
  outputLanguage: string;
  editorialProfileId?: string;
  conversationHistory?: ChatMessage[];
  isPro?: boolean; // Pro status from frontend
}

export interface ScriptChatResponse {
  scriptId: string;
  message: ChatMessage;
  currentScript: string;
  metadata: {
    wordCount: number;
    estimatedDuration: number;
    suggestedImprovements?: string[];
    hasScriptUpdate?: boolean;
    scriptStatus?: string;
    nextSteps?: string;
  };
}

// Streaming Response Type
export interface ScriptChatStreamResponse {
  type: "message_start" | "content_delta" | "message_complete" | "error";
  scriptId: string;
  content?: string;
  message?: ChatMessage;
  currentScript?: string;
  metadata?: {
    wordCount: number;
    estimatedDuration: number;
  };
  error?: string;
}

// Script List Types
export interface ScriptListItem {
  id: string;
  title: string;
  status: "draft" | "validated" | "used";
  current_script: string;
  output_language: string;
  updated_at: string;
  message_count: number;
  word_count: number;
  estimated_duration: number;
}

export interface ScriptListResponse {
  scripts: ScriptListItem[];
  totalCount: number;
  hasMore: boolean;
}

// Validation Schemas
export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  timestamp: z.string(),
  metadata: z
    .object({
      isStreaming: z.boolean().optional(),
      tokensUsed: z.number().optional(),
      model: z.string().optional(),
      hasScriptUpdate: z.boolean().optional(),
      scriptStatus: z.string().optional(),
    })
    .optional(),
});

export const scriptDraftSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["draft", "validated", "used"]),
  current_script: z.string(),
  messages: z.array(chatMessageSchema),
  output_language: z.string(),
  editorial_profile_id: z.string().optional(),
  word_count: z.number(),
  estimated_duration: z.number(),
  message_count: z.number(),
  version: z.number(),
  user_id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const scriptChatRequestSchema = z.object({
  scriptId: z.string().optional(),
  message: z.string(),
  outputLanguage: z.string(),
  editorialProfileId: z.string().optional(),
  conversationHistory: z.array(chatMessageSchema).optional(),
  isPro: z.boolean().optional(),
});

// Utility Functions
export const estimateScriptDuration = (script: string): number => {
  const wordCount = script.split(/\s+/).length;
  return wordCount * 0.9; // 0.9 seconds per word
};

export const generateScriptTitle = (script: string): string => {
  const firstLine = script.split("\n")[0] || "";
  const words = firstLine.split(" ");
  return words.slice(0, 6).join(" ") + (words.length > 6 ? "..." : "");
};

export const isValidScriptDraft = (draft: any): draft is ScriptDraft => {
  try {
    scriptDraftSchema.parse(draft);
    return true;
  } catch {
    return false;
  }
};

export const isValidChatMessage = (message: any): message is ChatMessage => {
  try {
    chatMessageSchema.parse(message);
    return true;
  } catch {
    return false;
  }
};
