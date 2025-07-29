import { Response } from "express";
import OpenAI from "openai";
import { supabase } from "../../config/supabase";
import { createOpenAIClient } from "../../config/openai";
import { PromptService } from "../promptService";
import type {
  ScriptChatRequest,
  ScriptChatResponse,
  ChatMessage,
  ScriptDraft,
} from "../../types/script";
import {
  estimateScriptDuration,
  generateScriptTitle,
} from "../../types/script";
import { Json } from "../../config/supabase-types";
import winston from "winston";
import { User } from "../../types/user";
import { MonetizationService, MonetizationErrorCode, MONETIZATION_ERROR_CODES, MonetizationError, Database, TableRow, Tables } from "editia-core";
// Dynamic import for @openai/agents will be handled in the function
import { z } from "zod";
import { logger } from "../../config/logger";
import { VIDEO_DURATION_FACTOR } from "../../config/video-constants";

const OutputSchema = z.object({
        script: z.string().describe("The script to be generated").nullable().optional(),
        hasScriptUpdate: z.boolean().describe("Whether the script has been updated"),
        conversation: z.string().describe("The conversation history"),
        metadata: z.object({
          wordCount: z.number().describe("The word count of the script").nullable().optional(),
          estimatedDuration: z.number().describe("The estimated duration of the script. The formula we use to estimate the rendering duration is: (wordCount* 0.7").nullable().optional(),
          status: z.enum(["draft", "ready", "needs_work", "failed"]).describe("The status of the script").nullable().optional(),
          nextSteps: z.string().describe("The next steps to be taken").nullable().optional(),
        }).nullable().optional(),
      });
export const ComputedVideoSchema = z.object({
  tiktok_video_id: z.string(),
  video_url: z.string(),
  description: z.string().optional(),
  upload_date: z.string().optional(),
  duration_seconds: z.number().optional(),
  is_sponsored: z.boolean(),
  is_ad: z.boolean(),
  hashtags: z.array(z.string()),
  music_info: z.any(),
});

      export const topVideoByMetricSchema = z.object({
  by_views: z.array(z.object({
    views: z.number(),
    ...ComputedVideoSchema.shape,
  })),
  by_likes: z.array(z.object({
    likes: z.number(),
    ...ComputedVideoSchema.shape,
  })),
  by_engagement: z.array(z.object({
    engagement_rate: z.number(),
    ...ComputedVideoSchema.shape,
  })),
});
/**
 * ScriptChatService - Handles conversational script generation
 *
 * This service manages the chat-based script creation workflow:
 * - Maintains conversation history
 * - Integrates editorial profile in each request
 * - Supports streaming responses
 * - Manages script drafts and iterations
 */
export class ScriptChatService {
  private user: User;
  private openai: OpenAI;
  private model: string = "gpt-4o-mini"; // Latest OpenAI model
  private logger: winston.Logger;

  constructor(user: User, logger: winston.Logger) {
    this.user = user;
    this.openai = createOpenAIClient();
    this.logger = logger;
  }

  /**
   * Handle standard chat interaction (non-streaming)
   */
  async handleChat(request: ScriptChatRequest): Promise<ScriptChatResponse> {
    try {
      // Use Promise.allSettled to handle concurrent requests
      const [scriptDraftResult, editorialProfileResult, tiktokContextResult] = await Promise.allSettled([
        this.getOrCreateScriptDraft(request),
        this.getEditorialProfile(request.editorialProfileId),
        request.scriptId ? this.getTikTokAnalysisContext(request.scriptId, this.user.id) : Promise.resolve(null)
      ]);

      // Check results and log appropriately
      if (scriptDraftResult.status === "fulfilled") {
        var scriptDraft = scriptDraftResult.value;
      } else {
        this.logger.error("❌ Failed to get or create script draft:", scriptDraftResult.reason);
        throw new Error("Failed to get or create script draft");
      }

      if (editorialProfileResult.status === "fulfilled") {
        var editorialProfile = editorialProfileResult.value;
      } else {
        this.logger.error("❌ Failed to get editorial profile:", editorialProfileResult.reason);
        throw new Error("Failed to get editorial profile");
      }

      let tiktokContext: string | null = null;
      if (request.scriptId) {
        if (tiktokContextResult.status === "fulfilled") {
          tiktokContext = tiktokContextResult.value;
        } else {
          this.logger.warn("⚠️ Failed to fetch TikTok context:", tiktokContextResult.reason);
        }
      } else {
        this.logger.info("ℹ️ No scriptId provided, skipping TikTok context fetch");
      }

      // Create conversation history
      const prompts = this.buildConversationHistoryForAgent(
        scriptDraft.messages,
        request.message,
        editorialProfile,
        tiktokContext
      );

      // Dynamic import for @openai/agents
      const { Agent, run } = await import('@openai/agents');

      const agent = new Agent({
        model: this.model,
        name: 'Script Chat Agent',
        instructions: prompts.instructions,
        outputType: OutputSchema,
      });
      const completion = await run(
        agent,
        [
          { role: "user", content: prompts.userMessage },
        ],
     
      );

      // Create chat messages
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: "user",
        content: request.message,
        timestamp: new Date().toISOString(),
      };

      const assistantChatMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: "assistant",
        content: completion.finalOutput?.conversation || "", // Store only the conversation part
        timestamp: new Date().toISOString(),
        metadata: {
          hasScriptUpdate: completion.finalOutput?.hasScriptUpdate || false,
          scriptStatus: completion.finalOutput?.metadata?.status || "draft",
        }
      };

      const scriptToSave = completion.finalOutput?.script || scriptDraft.current_script;

      // Update script draft
      const [updateDraftResult, trackVersionResult, updateTokenUsageResult] = await Promise.allSettled([
        this.updateScriptDraft(
          scriptDraft.id,
          scriptToSave,
          [userMessage, assistantChatMessage],
          scriptDraft.title
        ),
        completion.finalOutput?.hasScriptUpdate && completion.finalOutput?.script
          ? this.trackScriptVersion(
              scriptDraft.id,
              scriptDraft.current_script, // previous version
              completion.finalOutput?.script, // new version
              request.message,
              editorialProfile
            )
          : Promise.resolve(),
        this.updateTokenUsage(completion.state._context.usage.totalTokens)
      ]);

      if (updateDraftResult.status === "fulfilled") {
        this.logger.info("✅ Script draft updated successfully");
      } else {
        this.logger.error("❌ Failed to update script draft:", updateDraftResult.reason);
      }

      if (trackVersionResult.status === "rejected") {
        this.logger.error("❌ Failed to track script version:", trackVersionResult.reason);
      }

      if (updateTokenUsageResult.status === "rejected") {
        this.logger.warn("❌ Failed to update token usage:", updateTokenUsageResult.reason);
      }

      this.logger.info("📤 Returning response...");
      return {
        scriptId: scriptDraft.id,
        message: assistantChatMessage,
        currentScript: scriptToSave,
        metadata: {
          wordCount: scriptDraft.word_count,
          estimatedDuration: scriptDraft.estimated_duration,
          hasScriptUpdate: completion.finalOutput?.hasScriptUpdate,
          scriptStatus: completion.finalOutput?.metadata?.status || "draft",
          nextSteps: completion.finalOutput?.metadata?.nextSteps || "No next steps",
        },
      };
    } catch (error) {
      this.logger.error("❌ Script chat error:", error);
      throw error;
    }
  }

  async updateTokenUsage(tokensUsed: number) {
    const { data: tokensUsage, error: tokensUsageError } = await supabase
      .from("user_usage")
      .select("*")
      .eq("id", this.user.id)
      .single();

    if (tokensUsageError) {
      this.logger.warn("❌ Error fetching tokens usage:", tokensUsageError);
    }

    let newTokensUsed = 0;
    if (tokensUsage) {
      newTokensUsed = (tokensUsage.tokens_used || 0) + tokensUsed;
    } else {
      newTokensUsed = tokensUsed;
    }

    const { data, error } = await supabase
      .from("user_usage")
      .update({ tokens_used: newTokensUsed })
      .eq("id", this.user.id);

    if (error) {
      this.logger.error("❌ Error updating tokens usage:", error);
    }
  }

  /**
   * Handle streaming chat interaction
   */
  async handleStreamingChat(
    request: ScriptChatRequest,
    res: Response
  ): Promise<void> {
    try {
      this.logger.info(`🔄 Processing streaming chat for user ${this.user.id}`);

      // Step 1: Initializing
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      this.sendStreamMessage(res, {
        type: "status",
        message: "Démarrage de la génération du script...",
      });

      // Get or create script draft
      const scriptDraft = await this.getOrCreateScriptDraft(request);

      // Step 2: Loading profile
      this.sendStreamMessage(res, {
        type: "status_update",
        scriptId: scriptDraft.id,
        status: "loading_profile",
        message: "Chargement du profil éditorial...",
      });

      // Get editorial profile
      const editorialProfile = await this.getEditorialProfile(
        request.editorialProfileId
      );

      // Get TikTok analysis context
      let tiktokContext: string | null = null;
      if (request.scriptId) {
        tiktokContext = await this.getTikTokAnalysisContext(request.scriptId, this.user.id);
      }

      // Step 3: Building context
      this.sendStreamMessage(res, {
        type: "status_update",
        scriptId: scriptDraft.id,
        status: "building_context",
        message: "Analyse du contexte de conversation...",
      });

      // Create conversation history
      const conversationHistory = this.buildConversationHistory(
        scriptDraft.messages,
        request.message,
        editorialProfile,
        tiktokContext
      );

      // Step 4: Start generation
      this.sendStreamMessage(res, {
        type: "message_start",
        scriptId: scriptDraft.id,
        status: "generating",
        message: "Génération de la réponse...",
      });

      let fullResponse = "";

      // Create streaming completion
      const stream = await this.openai.chat.completions.create({
        model: this.model,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      });

      // Process stream
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          this.sendStreamMessage(res, {
            type: "content_delta",
            scriptId: scriptDraft.id,
            content,
          });
        }
      }

      // Step 5: Processing response
      this.sendStreamMessage(res, {
        type: "status_update",
        scriptId: scriptDraft.id,
        status: "processing",
        message: "Traitement de la réponse...",
      });

      // Extract script and finalize
      const extractedScript = this.extractScriptFromResponse(fullResponse);

      // Step 6: Updating draft
      this.sendStreamMessage(res, {
        type: "status_update",
        scriptId: scriptDraft.id,
        status: "updating_draft",
        message: "Mise à jour du script...",
      });

      // Create chat messages
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: "user",
        content: request.message,
        timestamp: new Date().toISOString(),
      };

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: "assistant",
        content: fullResponse,
        timestamp: new Date().toISOString(),
        metadata: {
          model: this.model,
        },
      };

      // Update script draft
      const updatedDraft = await this.updateScriptDraft(
        scriptDraft.id,
        extractedScript,
        [userMessage, assistantMessage]
      );

      // Track script version for improvement analytics
      await this.trackScriptVersion(
        scriptDraft.id,
        scriptDraft.current_script, // previous version
        extractedScript, // new version
        request.message,
        editorialProfile
      );

      // Send completion message
      this.sendStreamMessage(res, {
        type: "message_complete",
        scriptId: updatedDraft.id,
        message: assistantMessage,
        currentScript: extractedScript,
        metadata: {
          wordCount: updatedDraft.word_count,
          estimatedDuration: updatedDraft.estimated_duration,
        },
      });

      res.end();
    } catch (error) {
      this.logger.error("❌ Streaming chat error:", error);
      this.sendStreamMessage(res, {
        type: "error",
        scriptId: request.scriptId || "",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      res.end();
    }
  }

  /**
   * Get or create script draft
   */
  private async getOrCreateScriptDraft(
    request: ScriptChatRequest
  ): Promise<ScriptDraft> {
    if (request.scriptId) {
      // Fetch existing draft
      const { data: draft, error } = await supabase
        .from("script_drafts")
        .select("*")
        .eq("id", request.scriptId)
        .eq("user_id", this.user.id)
        .single();

      if (error || !draft) {
        throw new Error("Script draft not found");
      }

      return draft as unknown as ScriptDraft;
    } else {
      const monetizationService = MonetizationService.getInstance();
      const userUsage = await monetizationService.getUserUsage(this.user.id);
      if (!userUsage) {
        throw new Error("User usage not found");
      }
      if (userUsage.script_conversations_used >= userUsage.script_conversations_limit) {
        throw new MonetizationError("You have reached the maximum number of script conversations. Please upgrade to a paid plan to continue.", MONETIZATION_ERROR_CODES.USAGE_LIMIT_REACHED);
      }

      // Create new draft
      const { data: draft, error } = await supabase
        .from("script_drafts")
        .insert({
          user_id: this.user.id,
          title: "Nouveau Script",
          status: "draft",
          current_script: "",
          messages: [],
          output_language: request.outputLanguage,
          editorial_profile_id: request.editorialProfileId,
          word_count: 0,
          estimated_duration: 0,
          message_count: 0,
          version: 1,
        })
        .select()
        .single();

      if (error || !draft) {
        throw new Error("Failed to create script draft");
      }

      await monetizationService.incrementUsage(this.user.id, "script_conversations");

      return draft as unknown as ScriptDraft;
    }
  }

  /**
   * Update script draft with new content and messages
   */
  private async updateScriptDraft(
    scriptId: string,
    newScript: string,
    newMessages: ChatMessage[],
    title?: string,
  ): Promise<ScriptDraft> {
    // Calculate metadata
    const wordCount = newScript.split(/\s+/).length;
    const estimatedDuration = estimateScriptDuration(newScript);
    let newTitle = title;
    if (!title) {
    // Generate intelligent title from first user message or script content
     newTitle = await this.generateIntelligentTitle(newMessages, newScript);
    }

    // Get current draft to merge messages
    const { data: currentDraft, error: fetchError } = await supabase
      .from("script_drafts")
      .select("messages, version")
      .eq("id", scriptId)
      .single();

    if (fetchError) {
      throw new Error("Failed to fetch current draft");
    }

    const allMessages = [
      ...((currentDraft.messages as unknown as ChatMessage[]) || []),
      ...newMessages,
    ];

    // Update draft
    const { data: updatedDraft, error } = await supabase
      .from("script_drafts")
      .update({
        title: newTitle,
        current_script: newScript,
        messages: allMessages as unknown as Json[],
        word_count: wordCount,
        estimated_duration: estimatedDuration,
        message_count: allMessages.length,
        updated_at: new Date().toISOString(),
        version: (currentDraft.version || 1) + 1,
      })
      .eq("id", scriptId)
      .select()
      .single();

    if (error || !updatedDraft) {
      throw new Error("Failed to update script draft");
    }

    return updatedDraft as unknown as ScriptDraft;
  }

  /**
   * Get editorial profile for context
   */
  private async getEditorialProfile(profileId?: string): Promise<any> {
    if (!profileId) {
      // Get user's default editorial profile
      const { data: profile, error } = await supabase
        .from("editorial_profiles")
        .select("*")
        .eq("user_id", this.user.id)
        .single();

      return profile || this.getDefaultEditorialProfile();
    }

    const { data: profile, error } = await supabase
      .from("editorial_profiles")
      .select("*")
      .eq("id", profileId)
      .eq("user_id", this.user.id)
      .single();

    return profile || this.getDefaultEditorialProfile();
  }

  /**
   * Get default editorial profile
   */
  private getDefaultEditorialProfile() {
    return {
      persona_description:
        "Créateur de contenu professionnel axé sur une communication claire et engageante",
      tone_of_voice: "Conversationnel et amical, tout en restant professionnel",
      audience: "Professionnels passionnés par la productivité et l'innovation",
      style_notes:
        "Explications claires avec des exemples pratiques, maintenant un équilibre entre informatif et engageant",
    };
  }

  /**
   * Build conversation history for OpenAI using structured prompt design
   */
  private buildConversationHistoryForAgent(
    previousMessages: ChatMessage[],
    currentMessage: string,
    editorialProfile: any,
    tiktokContext?: string | null
  ): {
    instructions: string;
    userMessage: string;
  } {
    // Get the structured prompt from prompt bank
    const promptTemplate = PromptService.fillPromptTemplate(
      "script-chat-conversation-agent",
      {
        messageHistory: this.formatMessageHistory(previousMessages),
        currentMessage: currentMessage,
        editorialProfile: this.formatEditorialProfile(editorialProfile),
        outputLanguage: "fr", // Default to French, should be passed from request
        currentScript: this.getCurrentScriptFromMessages(previousMessages),
        tiktokAnalysis:
          tiktokContext || "Aucune analyse TikTok disponible pour ce compte.",
      }
    );

    if (!promptTemplate) {
      this.logger.warn(
        "⚠️ Script chat prompt template not found, using fallback"
      );
      throw new Error("Script chat prompt template not found");
    }

    return {instructions: promptTemplate.system, userMessage: promptTemplate.user};
  }
  /**
   * Build conversation history for OpenAI using structured prompt design
   */
  private buildConversationHistory(
    previousMessages: ChatMessage[],
    currentMessage: string,
    editorialProfile: any,
    tiktokContext?: string | null
  ): any[] {
    // Get the structured prompt from prompt bank
    const promptTemplate = PromptService.fillPromptTemplate(
      "script-chat-conversation-agent",
      {
        messageHistory: this.formatMessageHistory(previousMessages),
        currentMessage: currentMessage,
        editorialProfile: this.formatEditorialProfile(editorialProfile),
        outputLanguage: "fr", // Default to French, should be passed from request
        currentScript: this.getCurrentScriptFromMessages(previousMessages),
        tiktokAnalysis:
          tiktokContext || "Aucune analyse TikTok disponible pour ce compte.",
      }
    );

    if (!promptTemplate) {
      // Fallback to basic prompt if template not found
      this.logger.warn(
        "⚠️ Script chat prompt template not found, using fallback"
      );
      return this.buildFallbackConversationHistory(
        previousMessages,
        currentMessage,
        editorialProfile,
        tiktokContext
      );
    }

    const systemMessage = {
      role: "system",
      content: promptTemplate.system,
    };

    const userMessage = {
      role: "user",
      content: promptTemplate.user,
    };

    // Build conversation with system prompt and structured user message
    const messages = [systemMessage];

    // Add previous conversation history (excluding the current message)
    previousMessages.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // Add the structured current message
    messages.push(userMessage);

    return messages;
  }

  /**
   * Format message history for prompt template
   */
  private formatMessageHistory(messages: ChatMessage[]): string {
    if (!messages || messages.length === 0) {
      return "No previous messages - this is the start of a new conversation.";
    }
    if (messages.length > 10) {
      return messages.slice(0, 10).map((msg) => {
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        return `[${timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`;
      }).join("\n\n");
    }

    return messages
      .map((msg) => {
        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        return `[${timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`;
      })
      .join("\n\n");
  }

  /**
   * Format editorial profile for prompt template
   */
  private formatEditorialProfile(profile: any): string {
    if (!profile) {
      return "No editorial profile available.";
    }

    return `
**Persona:** ${profile.persona_description || "Non défini"}
**Ton de voix:** ${profile.tone_of_voice || "Non défini"}
**Audience cible:** ${profile.audience || "Non défini"}
**Notes de style:** ${profile.style_notes || "Non défini"}
    `.trim();
  }

  /**
   * Extract current script content from message history
   */
  private getCurrentScriptFromMessages(messages: ChatMessage[]): string {
    if (!messages || messages.length === 0) {
      return "No current script available.";
    }

    // Find the most recent script content from assistant messages
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg && msg.role === "assistant" && msg.content) {
        const script = this.extractScriptFromResponse(msg.content);
        if (script && script.length > 10) {
          // Basic validation
          return script;
        }
      }
    }
    return "No current script available.";
  }

  /**
   * Fallback conversation history builder
   */
  private buildFallbackConversationHistory(
    previousMessages: ChatMessage[],
    currentMessage: string,
    editorialProfile: any,
    tiktokContext?: string | null
  ): any[] {
    const systemMessage = {
      role: "system",
      content: `Tu es un expert en création de scripts pour les vidéos courtes (TikTok, Instagram Reels, YouTube Shorts).

Tu aides les créateurs à développer et affiner leurs scripts en mode conversationnel.

CONTEXTE:
- Les scripts sont des voix-off pour des vidéos de 30-60 secondes
- Les vidéos sont muettes, le script est le seul audio
- Optimisé pour la synthèse vocale ElevenLabs

PROFIL ÉDITORIAL:
- Persona: ${editorialProfile.persona_description}
- Ton: ${editorialProfile.tone_of_voice}
- Audience: ${editorialProfile.audience}
- Style: ${editorialProfile.style_notes}

${tiktokContext ? `\n${tiktokContext}\n` : ""}

STRUCTURE RECOMMANDÉE:
1. Accroche (1-2 lignes): captiver l'attention
2. Valeur/Insight (3-6 lignes): message principal
3. Conclusion (1-2 lignes): conclusion impactante

DIRECTIVES:
- Réponds de manière conversationnelle et collaborative
- Propose des améliorations constructives
- Adapte-toi au profil éditorial fourni
- Garde les scripts entre 30-60 secondes à l'oral
- Utilise un français naturel et fluide

Si l'utilisateur demande un nouveau script, génère-le directement.
Si l'utilisateur demande des modifications, applique-les et fournis le script mis à jour.`,
    };

    const messages = [systemMessage];

    // Add previous conversation history
    previousMessages.forEach((msg) => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({
      role: "user",
      content: currentMessage,
    });

    return messages;
  }

  /**
   * Generate intelligent title using AI
   */
  private async generateIntelligentTitle(
    messages: ChatMessage[],
    script: string
  ): Promise<string> {
    try {
      // Use the first user message to generate a descriptive title
      const firstUserMessage = messages.find(
        (msg) => msg.role === "user"
      )?.content;

      if (!firstUserMessage) {
        return generateScriptTitle(script);
      }

      const titlePrompt = `Génère un titre court et descriptif (maximum 6 mots) pour un script vidéo basé sur cette demande utilisateur: "${firstUserMessage}"

Le titre doit être:
- Court et accrocheur
- Descriptif du contenu
- Sans ponctuation finale
- En français

Exemples:
- "3 astuces productivité" → "3 Astuces Productivité Essentielles"
- "expliquer l'IA" → "Comprendre l'IA Simplement"
- "café bienfaits" → "Bienfaits du Café Santé"

Réponds uniquement avec le titre, sans guillemets ni explications.`;

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Use faster model for title generation
        messages: [
          {
            role: "user",
            content: titlePrompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 50,
      });

      const generatedTitle = completion.choices[0]?.message?.content?.trim();

      if (generatedTitle && generatedTitle.length <= 50) {
        return generatedTitle;
      }

      // Fallback to simple title generation
      return generateScriptTitle(script);
    } catch (error) {
      this.logger.warn("Failed to generate AI title, using fallback:", error);
      return generateScriptTitle(script);
    }
  }

  /**
   * Parse structured JSON response from OpenAI
   */
  private parseStructuredResponse(response: string): {
    conversation: string;
    script?: string;
    hasScriptUpdate: boolean;
    metadata?: {
      wordCount: number;
      estimatedDuration: number;
      status: string;
      nextSteps?: string;
    };
  } {
    try {
      const parsed = JSON.parse(response);

      // Validate required fields
      if (!parsed.conversation) {
        throw new Error("Missing conversation field in structured response");
      }

      // Calculate metadata if script is provided
      let metadata = parsed.metadata || {};
      if (parsed.script && parsed.hasScriptUpdate) {
        const words = parsed.script.split(/\s+/).length;
        metadata = {
          wordCount: words,
          estimatedDuration: Math.round(words * VIDEO_DURATION_FACTOR),
          status: metadata.status || "draft",
          nextSteps: metadata.nextSteps,
        };
      }

      return {
        conversation: parsed.conversation,
        script: parsed.script,
        hasScriptUpdate: Boolean(parsed.hasScriptUpdate),
        metadata,
      };
    } catch (error) {
      this.logger.warn(
        "⚠️ Failed to parse structured response, falling back to extraction:",
        error
      );

      // Fallback to old extraction method
      const extractedScript = this.extractScriptFromResponse(response);
      return {
        conversation: response,
        script: extractedScript,
        hasScriptUpdate: true,
        metadata: {
          wordCount: extractedScript.split(/\s+/).length,
          estimatedDuration: Math.round(
            extractedScript.split(/\s+/).length * 0.4
          ),
          status: "draft",
        },
      };
    }
  }

  /**
   * Extract script content from AI response (fallback method)
   */
  private extractScriptFromResponse(response: string): string {
    // Look for script markers or extract the main content
    const scriptMarkers = [
      /```script\n(.*?)\n```/s,
      /```\n(.*?)\n```/s,
      /SCRIPT:\n(.*?)(?:\n\n|\n---|\nCONCLUSION:|$)/s,
    ];

    for (const marker of scriptMarkers) {
      const match = response.match(marker);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // If no markers found, return the full response (assuming it's the script)
    return response.trim();
  }

  /**
   * Track script version for analytics and improvement
   */
  private async trackScriptVersion(
    scriptId: string,
    previousScript: string,
    newScript: string,
    userMessage: string,
    editorialProfile: any
  ): Promise<void> {
    try {
      // Only track if there's an actual change
      if (previousScript === newScript) return;

      // Log to general logs table
      await supabase.from("logs").insert({
        user_id: this.user.id,
        action: "script_version_update",
        resource_type: "script_draft",
        resource_id: scriptId,
        metadata: {
          previous_script: previousScript,
          new_script: newScript,
          user_message: userMessage,
          editorial_profile: editorialProfile,
          change_metrics: {
            word_count_before: previousScript.split(/\s+/).length,
            word_count_after: newScript.split(/\s+/).length,
            character_diff: newScript.length - previousScript.length,
          },
        },
      });

      this.logger.info("✅ Script version tracked for analytics");
    } catch (error) {
      this.logger.warn("⚠️ Failed to track script version:", error);
      // Don't throw - this shouldn't break the main flow
    }
  }

  /**
   * Classify the type of improvement requested
   */
  private classifyImprovementType(userMessage: string): string {
    const message = userMessage.toLowerCase();

    if (message.includes("émotion") || message.includes("sentiment"))
      return "emotional_enhancement";
    if (message.includes("court") || message.includes("raccourcir"))
      return "length_reduction";
    if (message.includes("long") || message.includes("développer"))
      return "length_expansion";
    if (message.includes("ton") || message.includes("style"))
      return "tone_adjustment";
    if (message.includes("clair") || message.includes("simple"))
      return "clarity_improvement";
    if (message.includes("accroche") || message.includes("hook"))
      return "hook_enhancement";
    if (message.includes("conclusion") || message.includes("fin"))
      return "conclusion_improvement";

    return "general_improvement";
  }

  /**
   * Send streaming message
   */
  private sendStreamMessage(res: Response, data: any): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /**
   * Get TikTok analysis context for the user
   */
  private async getTikTokAnalysisContext(
    scriptId: string, 
    user_id: string
  ): Promise<string | null> {
    try {
      this.logger.info("🎯 Getting TikTok analysis context...");

      const { data: analysis } = await supabase
        .from("analyses")
        .select("account_id")
        .eq("user_id", user_id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!analysis || !analysis.account_id) {
        this.logger.info("📭 No valid TikTok analysis found for this user.");
        return null;
      }

      const accountContext = await this.fetchTiktokAccountContext(analysis.account_id);

        return this.formatTikTokAnalysisContext(accountContext);
    } catch (error) {
      this.logger.error("❌ Error fetching TikTok analysis context:", error);
      return null;
    }
  }

  /**
   * Format TikTok analysis for agent context
   */
  private formatTikTokAnalysisContext(fullContext: Awaited<ReturnType<typeof this.fetchTiktokAccountContext>> | null): string {
    if (!fullContext) {
      return `## 📱 ANALYSE TIKTOK\n\nL'analyse détaillée du compte n'est pas disponible pour le moment.`;
    }

    const { account, stats, aggregates, insights, top_videos } = fullContext;

    let context = `## 📱 ANALYSE TIKTOK DISPONIBLE\n\n**Compte analysé :** @${account?.tiktok_handle}\n**Statut :** ✅ Analyse complète\n`;

    if (stats) {
      context += `\n### 📊 Données du compte\n- **Abonnés :** ${
        stats.followers_count?.toLocaleString() || "N/A"
      }\n- **Vidéos :** ${
        stats.videos_count || "N/A"
      }\n- **Taux d'engagement :** ${
        stats.engagement_rate?.toFixed(2) || "N/A"
      }%\n`;
    }

    if (aggregates) {
      context += `\n### 🚀 Indicateurs Clés\n- **Vues moyennes:** ${Math.round(
        aggregates.avg_views || 0
      ).toLocaleString()}\n- **Meilleur moment pour poster (UTC):** ${
        aggregates.best_posting_time || "N/A"
      }\n- **Fréquence de publication:** ~${Math.round(
        aggregates.posting_frequency_weekly || 0
      )} vidéos/semaine\n`;
    }

    if (insights) {
      if (insights.profile_summary) {
        context += `\n### 🎯 Profil & Audience (par l'IA)\n- **Niche:** ${
          (insights?.profile_summary as any)?.niche || "Non définie"
        }\n- **Audience:** ${
          (insights?.profile_summary as any)?.audience_profile?.description || "Non défini"
        }\n`;
      }
      if ((insights as any)?.content_analysis?.content_pillars) {
        context += `\n### 🎨 Piliers de Contenu\n${(insights as any)?.content_analysis.content_pillars
          .map((p: any) => `- **${p.name}**`)
          .join("\n")}\n`;
      }
      if ((insights as any)?.recommendations?.content_strategy) {
        context += `\n### 🔥 Recommandation Stratégique Clé\n- ${(insights as any)?.recommendations.content_strategy[0]?.action}\n`;
      }
    }

    if (top_videos) {
      context += `\n### 🎥 Vidéos les plus populaires\n${top_videos.map((v: any) => `- (${v.raw_transcription})`).join("\n")}\n`;
    }

    context += `\n---
**💡 Instructions pour l'agent de script :**
- Utilise ces données pour personnaliser tes recommandations de script.
- Adapte le style et le ton selon l'analyse de l'audience.
- Propose des sujets alignés avec les piliers de contenu et la recommandation stratégique.`;

    return context;
  }

     async getAccountWithStats(accountId: string): Promise<{
    account: TableRow<'accounts'>;
    stats: TableRow<'accounts_stats'> | null;
  } | null> {
    try {
      // Get account
      const { data: account, error: accountError } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .single();

      if (accountError) throw accountError;

      // Get latest stats
      const { data: stats, error: statsError } = await supabase
        .from("accounts_stats")
        .select("*")
        .eq("account_id", accountId)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (statsError && statsError.code !== "PGRST116") {
        throw statsError;
      }

      return {
        account,
        stats,
      };
    } catch (error) {
      this.logger.error("❌ Failed to get account with stats:", error);
      throw error;
    }
  }
    /**
   * Get account aggregates
   */
   async getAccountAggregates(
    accountId: string, withTopVideos: boolean = false
  ): Promise<
    {accountAggregates: Tables<"accounts_aggregates"> | null, topVideos?: Tables<"tiktok_video_details">[] | null}
  > {
    try {
      const { data, error } = await supabase
        .from("accounts_aggregates")
        .select("*")
        .eq("account_id", accountId)
        .single();

      if (error && error.code !== "PGRST116") {
        logger.error("❌ Failed to get account aggregates:", error);
        throw error;
      }

      if (withTopVideos) {
        const rawTopVideos = topVideoByMetricSchema.safeParse(data?.top_videos);
        const rawTopVideosIds = rawTopVideos.success ? rawTopVideos.data.by_views.map((video) => video.tiktok_video_id) : [];

        const { data: tikTokVideos, error: tikTokVideosError } = await supabase
          .from("tiktok_videos")
          .select("id")
          .in("tiktok_video_id", rawTopVideosIds)

          if (tikTokVideosError) {
            logger.error("❌ Failed to get tiktok videos:", tikTokVideosError);
            throw tikTokVideosError;
          }

        const { data: topVideos, error: topVideosError } = await supabase
          .from("tiktok_video_details")
          .select("*")
          .in("video_id", tikTokVideos.map((video) => video.id))
          .order("last_scraped_at", { ascending: false })
          .limit(10); 

        if (topVideosError) {
          logger.error("❌ Failed to get tiktok video details:", topVideosError);
          throw topVideosError;
        }

        return {
          accountAggregates: data,
          topVideos: topVideos,
        };

      } else {  
        return {
          accountAggregates: data,
        };
      }
    } catch (error) {
      logger.error("❌ Failed to get account aggregates:", error);
      throw error;
    }
  }

    /**
   * 🆕 Get the latest structured LLM insights for an account.
   */
   async getLatestLlmInsights(accountId: string) {
    try {
      const { data, error } = await supabase
        .from("accounts_llm_insights")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data;
    } catch (error) {
      logger.error("❌ Failed to get latest LLM insights:", error);
      throw error;
    }
  }

  async fetchTiktokAccountContext(accountId: string): Promise<{
    account: TableRow<'accounts'> | null;
    stats: TableRow<'accounts_stats'> | null;
    aggregates: Tables<'accounts_aggregates'> | null;
    top_videos: Tables<'tiktok_video_details'>[] | null;
    insights: Tables<'accounts_llm_insights'> | null;
  }> {
    const [accountWithStats, accountAggregates, latestLlmInsights] = await Promise.allSettled([
        this.getAccountWithStats(accountId),
        this.getAccountAggregates(accountId, true),
        this.getLatestLlmInsights(accountId),
      ]);

      let accountValue: TableRow<'accounts'> | null = null;
      let accountStatsValue: TableRow<'accounts_stats'> | null = null;
      let accountAggregatesValue: Tables<'accounts_aggregates'> | null = null;
      let topVideosValue: Tables<'tiktok_video_details'>[] | null = null;
      let latestLlmInsightsValue: Tables<'accounts_llm_insights'> | null = null;

      if (accountWithStats.status === "fulfilled") {
        accountValue = accountWithStats.value?.account || null;
        accountStatsValue = accountWithStats.value?.stats || null;
      } else {
        this.logger.error("❌ Failed to get account with stats:", accountWithStats.reason);
      }

      if (accountAggregates.status === "fulfilled") {
        accountAggregatesValue = accountAggregates.value?.accountAggregates || null;
        topVideosValue = accountAggregates.value?.topVideos || null;
      } else {
        this.logger.error("❌ Failed to get account aggregates:", accountAggregates.reason);
      }

      if (latestLlmInsights.status === "fulfilled") {
        latestLlmInsightsValue = latestLlmInsights.value;
      } else {
        this.logger.error("❌ Failed to get latest LLM insights:", latestLlmInsights.reason);
      }

      return {
        account: accountValue,
        stats: accountStatsValue,
        aggregates: accountAggregatesValue,
        top_videos: topVideosValue,
        insights: latestLlmInsightsValue,
      };
  }
}
