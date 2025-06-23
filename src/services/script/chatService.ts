import { Response } from "express";
import { User } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { supabase } from '../../config/supabase';
import { createOpenAIClient } from '../../config/openai';
import { PromptService } from '../promptService';
import type { 
  ScriptChatRequest, 
  ScriptChatResponse, 
  ChatMessage, 
  ScriptDraft
} from '../../types/script';
import { 
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
      console.log(`📝 Request message: ${request.message}`);

      // Get or create script draft
      console.log('🔄 Getting or creating script draft...');
      const scriptDraft = await this.getOrCreateScriptDraft(request);
      console.log(`✅ Script draft: ${scriptDraft.id}`);
      
      // Get editorial profile
      console.log('👤 Getting editorial profile...');
      const editorialProfile = await this.getEditorialProfile(request.editorialProfileId);
      console.log(`✅ Editorial profile loaded`);
      
      // Get TikTok analysis context
      console.log('📱 Getting TikTok analysis context...');
      const tiktokContext = await this.getTikTokAnalysisContext();
      console.log(tiktokContext ? '✅ TikTok analysis context loaded' : '📭 No TikTok analysis available');
      
      // Create conversation history
      console.log('💭 Building conversation history...');
      const conversationHistory = this.buildConversationHistory(
        scriptDraft.messages,
        request.message,
        editorialProfile,
        tiktokContext
      );
      console.log(`✅ Conversation history built: ${conversationHistory.length} messages`);

      // Generate response with structured output
      console.log('🤖 Calling OpenAI with structured output...');
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: conversationHistory,
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" },
      });
      console.log('✅ OpenAI response received');

      const assistantMessage = completion.choices[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error('No response generated from OpenAI');
      }
      console.log(`📝 Assistant message length: ${assistantMessage.length}`);

      // Parse structured response
      console.log('🔍 Parsing structured response...');
      const structuredResponse = this.parseStructuredResponse(assistantMessage);
      console.log(`✅ Structured response parsed:`, {
        hasScript: !!structuredResponse.script,
        hasScriptUpdate: structuredResponse.hasScriptUpdate,
        conversationLength: structuredResponse.conversation.length
      });
      
      // Create chat messages
      console.log('💬 Creating chat messages...');
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user`,
        role: 'user',
        content: request.message,
        timestamp: new Date().toISOString(),
      };

      const assistantChatMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: structuredResponse.conversation, // Store only the conversation part
        timestamp: new Date().toISOString(),
        metadata: {
          tokensUsed: completion.usage?.total_tokens,
          model: this.model,
          hasScriptUpdate: structuredResponse.hasScriptUpdate,
          scriptStatus: structuredResponse.metadata?.status,
        },
      };

      // Determine script to save (use existing if no update)
      const scriptToSave = structuredResponse.hasScriptUpdate && structuredResponse.script 
        ? structuredResponse.script 
        : scriptDraft.current_script;

      // Update script draft
      console.log('💾 Updating script draft...');
      const updatedDraft = await this.updateScriptDraft(
        scriptDraft.id,
        scriptToSave,
        [userMessage, assistantChatMessage]
      );
      console.log('✅ Script draft updated successfully');

      // Track script version for improvement analytics
      if (structuredResponse.hasScriptUpdate && structuredResponse.script) {
        await this.trackScriptVersion(
          scriptDraft.id,
          scriptDraft.current_script, // previous version
          structuredResponse.script, // new version
          request.message,
          editorialProfile
        );
      }

      console.log('📤 Returning response...');
      return {
        scriptId: updatedDraft.id,
        message: assistantChatMessage,
        currentScript: scriptToSave,
        metadata: {
          wordCount: updatedDraft.word_count,
          estimatedDuration: updatedDraft.estimated_duration,
          hasScriptUpdate: structuredResponse.hasScriptUpdate,
          scriptStatus: structuredResponse.metadata?.status,
          nextSteps: structuredResponse.metadata?.nextSteps,
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

      // Step 1: Initializing
      this.sendStreamMessage(res, {
        type: 'status_update',
        scriptId: request.scriptId || '',
        status: 'initializing',
        message: 'Initialisation de la conversation...',
      });

      // Get or create script draft
      const scriptDraft = await this.getOrCreateScriptDraft(request);
      
      // Step 2: Loading profile
      this.sendStreamMessage(res, {
        type: 'status_update',
        scriptId: scriptDraft.id,
        status: 'loading_profile',
        message: 'Chargement du profil éditorial...',
      });
      
      // Get editorial profile
      const editorialProfile = await this.getEditorialProfile(request.editorialProfileId);
      
      // Get TikTok analysis context
      const tiktokContext = await this.getTikTokAnalysisContext();
      
      // Step 3: Building context
      this.sendStreamMessage(res, {
        type: 'status_update',
        scriptId: scriptDraft.id,
        status: 'building_context',
        message: 'Analyse du contexte de conversation...',
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
        type: 'message_start',
        scriptId: scriptDraft.id,
        status: 'generating',
        message: 'Génération de la réponse...',
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

      // Step 5: Processing response
      this.sendStreamMessage(res, {
        type: 'status_update',
        scriptId: scriptDraft.id,
        status: 'processing',
        message: 'Traitement de la réponse...',
      });

      // Extract script and finalize
      const extractedScript = this.extractScriptFromResponse(fullResponse);
      
      // Step 6: Updating draft
      this.sendStreamMessage(res, {
        type: 'status_update',
        scriptId: scriptDraft.id,
        status: 'updating_draft',
        message: 'Mise à jour du script...',
      });
      
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
    
    // Generate intelligent title from first user message or script content
    const title = await this.generateIntelligentTitle(newMessages, newScript);

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
      'script-chat-conversation-agent',
      {
        messageHistory: this.formatMessageHistory(previousMessages),
        currentMessage: currentMessage,
        editorialProfile: this.formatEditorialProfile(editorialProfile),
        outputLanguage: 'fr', // Default to French, should be passed from request
        currentScript: this.getCurrentScriptFromMessages(previousMessages),
        tiktokAnalysis: tiktokContext || 'Aucune analyse TikTok disponible pour ce compte.',
      }
    );

    if (!promptTemplate) {
      // Fallback to basic prompt if template not found
      console.warn('⚠️ Script chat prompt template not found, using fallback');
      return this.buildFallbackConversationHistory(previousMessages, currentMessage, editorialProfile, tiktokContext);
    }

    const systemMessage = {
      role: 'system',
      content: promptTemplate.system,
    };

    const userMessage = {
      role: 'user',
      content: promptTemplate.user,
    };

    // Build conversation with system prompt and structured user message
    const messages = [systemMessage];

    // Add previous conversation history (excluding the current message)
    previousMessages.forEach(msg => {
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

    return messages.map(msg => {
      const timestamp = new Date(msg.timestamp).toLocaleTimeString();
      return `[${timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`;
    }).join('\n\n');
  }

  /**
   * Format editorial profile for prompt template
   */
  private formatEditorialProfile(profile: any): string {
    if (!profile) {
      return "No editorial profile available.";
    }

    return `
**Persona:** ${profile.persona_description || 'Non défini'}
**Ton de voix:** ${profile.tone_of_voice || 'Non défini'}
**Audience cible:** ${profile.audience || 'Non défini'}
**Notes de style:** ${profile.style_notes || 'Non défini'}
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
      if (msg && msg.role === 'assistant' && msg.content) {
        const script = this.extractScriptFromResponse(msg.content);
        if (script && script.length > 10) { // Basic validation
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

${tiktokContext ? `\n${tiktokContext}\n` : ''}

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
   * Generate intelligent title using AI
   */
  private async generateIntelligentTitle(messages: ChatMessage[], script: string): Promise<string> {
    try {
      // Use the first user message to generate a descriptive title
      const firstUserMessage = messages.find(msg => msg.role === 'user')?.content;
      
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
        model: 'gpt-4o-mini', // Use faster model for title generation
        messages: [
          {
            role: 'user',
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
      console.warn('Failed to generate AI title, using fallback:', error);
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
        throw new Error('Missing conversation field in structured response');
      }

      // Calculate metadata if script is provided
      let metadata = parsed.metadata || {};
      if (parsed.script && parsed.hasScriptUpdate) {
        const words = parsed.script.split(/\s+/).length;
        metadata = {
          wordCount: words,
          estimatedDuration: Math.round(words * 0.4), // ~150 words per minute = 0.4 seconds per word
          status: metadata.status || 'draft',
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
      console.warn('⚠️ Failed to parse structured response, falling back to extraction:', error);
      
      // Fallback to old extraction method
      const extractedScript = this.extractScriptFromResponse(response);
      return {
        conversation: response,
        script: extractedScript,
        hasScriptUpdate: true,
        metadata: {
          wordCount: extractedScript.split(/\s+/).length,
          estimatedDuration: Math.round(extractedScript.split(/\s+/).length * 0.4),
          status: 'draft',
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
      await supabase.from('logs').insert({
        user_id: this.user.id,
        action: 'script_version_update',
        resource_type: 'script_draft',
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

      // Track for RL training data (future fine-tuning)
      await supabase.from('rl_training_data').insert({
        user_id: this.user.id,
        input_context: JSON.stringify({
          previous_script: previousScript,
          user_feedback: userMessage,
          editorial_profile: editorialProfile,
        }),
        model_output: newScript,
        feedback_type: 'script_improvement',
        quality_score: null, // To be filled by user feedback later
        metadata: {
          script_id: scriptId,
          improvement_type: this.classifyImprovementType(userMessage),
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ Script version tracked for analytics');
    } catch (error) {
      console.warn('⚠️ Failed to track script version:', error);
      // Don't throw - this shouldn't break the main flow
    }
  }

  /**
   * Classify the type of improvement requested
   */
  private classifyImprovementType(userMessage: string): string {
    const message = userMessage.toLowerCase();
    
    if (message.includes('émotion') || message.includes('sentiment')) return 'emotional_enhancement';
    if (message.includes('court') || message.includes('raccourcir')) return 'length_reduction';
    if (message.includes('long') || message.includes('développer')) return 'length_expansion';
    if (message.includes('ton') || message.includes('style')) return 'tone_adjustment';
    if (message.includes('clair') || message.includes('simple')) return 'clarity_improvement';
    if (message.includes('accroche') || message.includes('hook')) return 'hook_enhancement';
    if (message.includes('conclusion') || message.includes('fin')) return 'conclusion_improvement';
    
    return 'general_improvement';
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
  private async getTikTokAnalysisContext(): Promise<string | null> {
    try {
      console.log('🎯 Getting TikTok analysis context...');
      
      // Check if user has a TikTok analysis
      const { data: analyses } = await supabase
        .from('account_analyses')
        .select(`
          id,
          account_handle,
          status,
          insights,
          created_at,
          account_analysis
        `)
        .eq('user_id', this.user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!analyses || analyses.length === 0) {
        console.log('📭 No TikTok analysis found for user');
        return null;
      }

      const analysis = analyses[0];
      if (!analysis) {
        console.log('📭 No valid TikTok analysis found');
        return null;
      }
      
      console.log(`✅ Found TikTok analysis for @${analysis.account_handle}`);

      // Format analysis context for the agent
      const context = this.formatTikTokAnalysisContext(analysis);
      return context;

    } catch (error) {
      console.error('❌ Error fetching TikTok analysis:', error);
      return null;
    }
  }

  /**
   * Format TikTok analysis for agent context
   */
  private formatTikTokAnalysisContext(analysis: any): string {
    const accountData = analysis.account_analysis || {};
    const insights = analysis.insights || {};

    return `## 📱 ANALYSE TIKTOK DISPONIBLE

**Compte analysé :** @${analysis.account_handle}
**Statut :** ✅ Analyse complète

### 📊 Données du compte
- **Abonnés :** ${accountData.followers_count?.toLocaleString() || 'N/A'}
- **Vidéos :** ${accountData.videos_count || 'N/A'}
- **Taux d'engagement :** ${accountData.engagement_rate || 'N/A'}%

### 🎯 Insights principaux
${insights.performance_summary ? `**Performance :** ${insights.performance_summary}` : ''}

${insights.content_strategy ? `**Stratégie de contenu :** ${insights.content_strategy}` : ''}

${insights.audience_insights ? `**Audience :** ${insights.audience_insights}` : ''}

### 💪 Forces identifiées
${insights.strengths ? insights.strengths.map((s: string) => `- ${s}`).join('\n') : 'Non disponible'}

### ⚠️ Points d'amélioration
${insights.weaknesses ? insights.weaknesses.map((w: string) => `- ${w}`).join('\n') : 'Non disponible'}

### 🚀 Recommandations
${insights.recommendations ? insights.recommendations.map((r: string) => `- ${r}`).join('\n') : 'Non disponible'}

---
**💡 Instructions pour l'agent :**
- Utilise ces données pour personnaliser tes recommandations de script
- Adapte le style et le ton selon l'analyse de l'audience
- Propose des sujets alignés avec la stratégie de contenu identifiée
- Mentionne les forces à capitaliser et les points d'amélioration à adresser
- Si l'utilisateur demande des conseils spécifiques, référence-toi à cette analyse`;
  }
} 