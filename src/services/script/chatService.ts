import { Response } from "express";
import { User } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { supabase } from '../../config/supabase';
import { createOpenAIClient } from '../../config/openai';
import { 
  ScriptChatRequest, 
  ScriptChatResponse, 
  ChatMessage, 
  ScriptDraft,
  estimateScriptDuration,
  generateScriptTitle 
} from '../../types/script';

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
  private model: string = 'gpt-4o'; // Latest OpenAI model

  constructor(user: User) {
    this.user = user;
    this.openai = createOpenAIClient();
  }

  /**
   * Handle standard chat interaction (non-streaming)
   */
  async handleChat(request: ScriptChatRequest): Promise<ScriptChatResponse> {
    try {
      console.log(`💬 Processing chat for user ${this.user.id}`);

      // Get or create script draft
      const scriptDraft = await this.getOrCreateScriptDraft(request);
      
      // Get editorial profile
      const editorialProfile = await this.getEditorialProfile(request.editorialProfileId);
      
      // Create conversation history
      const conversationHistory = this.buildConversationHistory(
        scriptDraft.messages,
        request.message,
        editorialProfile
      );

      // Generate response
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 2000,
      });

      const assistantMessage = completion.choices[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error('No response generated from OpenAI');
      }

      // Extract script from response
      const extractedScript = this.extractScriptFromResponse(assistantMessage);
      
      // Create chat messages
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: request.message,
        timestamp: new Date().toISOString(),
      };

      const assistantChatMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: assistantMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          tokensUsed: completion.usage?.total_tokens,
          model: this.model,
        },
      };

      // Update script draft
      const updatedDraft = await this.updateScriptDraft(
        scriptDraft.id,
        extractedScript,
        [userMessage, assistantChatMessage]
      );

      return {
        scriptId: updatedDraft.id,
        message: assistantChatMessage,
        currentScript: extractedScript,
        metadata: {
          wordCount: updatedDraft.word_count,
          estimatedDuration: updatedDraft.estimated_duration,
        },
      };

    } catch (error) {
      console.error('❌ Script chat error:', error);
      throw error;
    }
  }

  /**
   * Handle streaming chat interaction
   */
  async handleStreamingChat(request: ScriptChatRequest, res: Response): Promise<void> {
    try {
      console.log(`🔄 Processing streaming chat for user ${this.user.id}`);

      // Get or create script draft
      const scriptDraft = await this.getOrCreateScriptDraft(request);
      
      // Get editorial profile
      const editorialProfile = await this.getEditorialProfile(request.editorialProfileId);
      
      // Create conversation history
      const conversationHistory = this.buildConversationHistory(
        scriptDraft.messages,
        request.message,
        editorialProfile
      );

      // Send initial message
      this.sendStreamMessage(res, {
        type: 'message_start',
        scriptId: scriptDraft.id,
      });

      let fullResponse = '';
      
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
            type: 'content_delta',
            scriptId: scriptDraft.id,
            content,
          });
        }
      }

      // Extract script and finalize
      const extractedScript = this.extractScriptFromResponse(fullResponse);
      
      // Create chat messages
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: request.message,
        timestamp: new Date().toISOString(),
      };

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
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

      // Send completion message
      this.sendStreamMessage(res, {
        type: 'message_complete',
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
      console.error('❌ Streaming chat error:', error);
      this.sendStreamMessage(res, {
        type: 'error',
        scriptId: request.scriptId || '',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.end();
    }
  }

  /**
   * Get or create script draft
   */
  private async getOrCreateScriptDraft(request: ScriptChatRequest): Promise<ScriptDraft> {
    if (request.scriptId) {
      // Fetch existing draft
      const { data: draft, error } = await supabase
        .from('script_drafts')
        .select('*')
        .eq('id', request.scriptId)
        .eq('user_id', this.user.id)
        .single();

      if (error || !draft) {
        throw new Error('Script draft not found');
      }

      return draft;
    } else {
      // Create new draft
      const { data: draft, error } = await supabase
        .from('script_drafts')
        .insert({
          user_id: this.user.id,
          title: 'Nouveau Script',
          status: 'draft',
          current_script: '',
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
        throw new Error('Failed to create script draft');
      }

      return draft;
    }
  }

  /**
   * Update script draft with new content and messages
   */
  private async updateScriptDraft(
    scriptId: string,
    newScript: string,
    newMessages: ChatMessage[]
  ): Promise<ScriptDraft> {
    // Calculate metadata
    const wordCount = newScript.split(/\s+/).length;
    const estimatedDuration = estimateScriptDuration(newScript);
    const title = generateScriptTitle(newScript);

         // Get current draft to merge messages
     const { data: currentDraft, error: fetchError } = await supabase
       .from('script_drafts')
       .select('messages, version')
       .eq('id', scriptId)
       .single();

     if (fetchError) {
       throw new Error('Failed to fetch current draft');
     }

     const allMessages = [...(currentDraft.messages || []), ...newMessages];

     // Update draft
     const { data: updatedDraft, error } = await supabase
       .from('script_drafts')
       .update({
         title,
         current_script: newScript,
         messages: allMessages,
         word_count: wordCount,
         estimated_duration: estimatedDuration,
         message_count: allMessages.length,
         updated_at: new Date().toISOString(),
         version: (currentDraft.version || 1) + 1,
       })
       .eq('id', scriptId)
       .select()
       .single();

    if (error || !updatedDraft) {
      throw new Error('Failed to update script draft');
    }

    return updatedDraft;
  }

  /**
   * Get editorial profile for context
   */
  private async getEditorialProfile(profileId?: string): Promise<any> {
    if (!profileId) {
      // Get user's default editorial profile
      const { data: profile, error } = await supabase
        .from('editorial_profiles')
        .select('*')
        .eq('user_id', this.user.id)
        .single();

      return profile || this.getDefaultEditorialProfile();
    }

    const { data: profile, error } = await supabase
      .from('editorial_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', this.user.id)
      .single();

    return profile || this.getDefaultEditorialProfile();
  }

  /**
   * Get default editorial profile
   */
  private getDefaultEditorialProfile() {
    return {
      persona_description: 'Créateur de contenu professionnel axé sur une communication claire et engageante',
      tone_of_voice: 'Conversationnel et amical, tout en restant professionnel',
      audience: 'Professionnels passionnés par la productivité et l\'innovation',
      style_notes: 'Explications claires avec des exemples pratiques, maintenant un équilibre entre informatif et engageant',
    };
  }

  /**
   * Build conversation history for OpenAI
   */
  private buildConversationHistory(
    previousMessages: ChatMessage[],
    currentMessage: string,
    editorialProfile: any
  ): any[] {
    const systemMessage = {
      role: 'system',
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
    previousMessages.forEach(msg => {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: currentMessage,
    });

    return messages;
  }

  /**
   * Extract script content from AI response
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
   * Send streaming message
   */
  private sendStreamMessage(res: Response, data: any): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
} 