import { Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { ClerkAuthService } from "../../services/clerkAuthService";
import { ScriptChatService } from "../../services/script/chatService";
import {
  successResponseExpress,
  errorResponseExpress,
  HttpStatus,
} from "../../utils/api/responses";
import { VideoGeneratorService } from "../../services/video/generator";
import { VideoValidationService } from "../../services/video/validation";

/**
 * Determines the appropriate HTTP status code based on error type
 * (Copied from videos.ts for consistency)
 */
function determineErrorStatusCode(error: any): number {
  // Database errors
  if (
    error.code &&
    (error.code.startsWith("22") || // Data exception
      error.code.startsWith("23") || // Integrity constraint violation
      error.code === "PGRST") // PostgREST error
  ) {
    return HttpStatus.BAD_REQUEST;
  }

  // Authentication/authorization errors
  if (
    error.message &&
    (error.message.includes("auth") ||
      error.message.includes("token") ||
      error.message.includes("unauthorized") ||
      error.message.includes("permission"))
  ) {
    return HttpStatus.UNAUTHORIZED;
  }

  // Missing resources
  if (
    error.message &&
    (error.message.includes("not found") || error.message.includes("missing"))
  ) {
    return HttpStatus.NOT_FOUND;
  }

  // External API errors (Creatomate)
  if (error.message && error.message.includes("Creatomate")) {
    return HttpStatus.SERVICE_UNAVAILABLE;
  }

  // Default to internal server error
  return HttpStatus.INTERNAL_SERVER_ERROR;
}
// import { scriptChatRequestSchema } from "../../types/script";

/**
 * Script Chat API endpoints - New modular system for script generation via chat
 * These endpoints are separate from the existing video generation pipeline
 */

/**
 * GET /api/scripts
 * Fetch all script drafts for authenticated user
 */
export async function getScriptDraftsHandler(req: Request, res: Response) {
  console.log("📋 Fetching script drafts...");

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    // Parse query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const status = req.query.status as string;

    // Fetch script drafts from database
    let query = supabase
      .from('script_drafts')
      .select(`
        id,
        title,
        status,
        current_script,
        output_language,
        updated_at,
        message_count,
        word_count,
        estimated_duration
      `)
      .eq('user_id', user!.id)
      .order('updated_at', { ascending: false });

    if (status && ['draft', 'validated', 'used'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: scripts, error, count } = await query
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      console.error("❌ Error fetching script drafts:", error);
      return errorResponseExpress(
        res,
        "Failed to fetch script drafts",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    console.log(`✅ Found ${scripts?.length || 0} script drafts for user ${user!.id}`);
    console.log('📝 Scripts data:', JSON.stringify(scripts, null, 2));

    return successResponseExpress(res, {
      scripts: scripts || [],
      totalCount: count || 0,
      hasMore: (count || 0) > page * limit,
      currentPage: page,
      limit
    });

  } catch (error) {
    console.error("❌ Script drafts fetch error:", error);
    return errorResponseExpress(
      res,
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * GET /api/scripts/:id
 * Fetch specific script draft with conversation history
 */
export async function getScriptDraftHandler(req: Request, res: Response) {
  console.log("📄 Fetching script draft details...");

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    const { id } = req.params;

    // Fetch script draft with messages
    const { data: scriptDraft, error } = await supabase
      .from('script_drafts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single();

    if (error || !scriptDraft) {
      console.error("❌ Script draft not found:", error);
      return errorResponseExpress(
        res,
        "Script draft not found",
        HttpStatus.NOT_FOUND
      );
    }

    console.log(`✅ Script draft found: ${scriptDraft.id}`);
    console.log(`📝 Messages count: ${scriptDraft.messages?.length || 0}`);
    console.log(`📄 Current script length: ${scriptDraft.current_script?.length || 0} chars`);

    return successResponseExpress(res, scriptDraft);

  } catch (error) {
    console.error("❌ Script draft fetch error:", error);
    return errorResponseExpress(
      res,
      "Internal server error",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/scripts/chat
 * Send message in script conversation (with streaming support)
 */
export async function scriptChatHandler(req: Request, res: Response) {
  console.log("💬 Processing script chat message...");

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    // Simple validation for now (we'll add Zod schema later)
    const payload = req.body;
    
    if (!payload.message || typeof payload.message !== 'string') {
      return errorResponseExpress(
        res,
        "Missing or invalid message field",
        HttpStatus.BAD_REQUEST
      );
    }

    // Check if streaming is requested
    const isStreaming = payload.streaming === true ||
                       req.headers.accept?.includes('text/event-stream') || 
                       req.query.stream === 'true';

    const scriptChatService = new ScriptChatService(user!);

    if (isStreaming) {
      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      await scriptChatService.handleStreamingChat(payload, res);
    } else {
      // Standard response
      const result = await scriptChatService.handleChat(payload);
      return successResponseExpress(res, result);
    }

  } catch (error) {
    console.error("❌ Script chat error:", error);
    return errorResponseExpress(
      res,
      "Failed to process chat message",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/scripts/:id/validate
 * Validate and finalize a script draft
 */
export async function validateScriptHandler(req: Request, res: Response) {
  console.log("✅ Validating script draft...");

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    const { id } = req.params;

    // Update script status to validated
    const { data: scriptDraft, error } = await supabase
      .from('script_drafts')
      .update({ 
        status: 'validated',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user!.id)
      .select()
      .single();

    if (error || !scriptDraft) {
      return errorResponseExpress(
        res,
        "Script draft not found or validation failed",
        HttpStatus.NOT_FOUND
      );
    }

    return successResponseExpress(res, {
      message: "Script validated successfully",
      script: scriptDraft
    });

  } catch (error) {
    console.error("❌ Script validation error:", error);
    return errorResponseExpress(
      res,
      "Failed to validate script",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * DELETE /api/scripts/:id
 * Delete a script draft
 */
export async function deleteScriptDraftHandler(req: Request, res: Response) {
  console.log("🗑️ Deleting script draft...");

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    const { id } = req.params;

    // Delete script draft
    const { error } = await supabase
      .from('script_drafts')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id);

    if (error) {
      console.error("❌ Error deleting script draft:", error);
      return errorResponseExpress(
        res,
        "Failed to delete script draft",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return successResponseExpress(res, {
      message: "Script draft deleted successfully"
    });

  } catch (error) {
    console.error("❌ Script deletion error:", error);
    return errorResponseExpress(
      res,
      "Failed to delete script draft",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/scripts/:id/duplicate
 * Duplicate an existing script draft
 */
export async function duplicateScriptDraftHandler(req: Request, res: Response) {
  console.log("📋 Duplicating script draft...");

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    const { id } = req.params;

    // Fetch original script
    const { data: originalScript, error: fetchError } = await supabase
      .from('script_drafts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user!.id)
      .single();

    if (fetchError || !originalScript) {
      return errorResponseExpress(
        res,
        "Script draft not found",
        HttpStatus.NOT_FOUND
      );
    }

    // Create duplicate
    const { data: duplicatedScript, error: createError } = await supabase
      .from('script_drafts')
      .insert({
        user_id: user!.id,
        title: `${originalScript.title} (Copie)`,
        status: 'draft',
        current_script: originalScript.current_script,
        messages: originalScript.messages,
        output_language: originalScript.output_language,
        editorial_profile_id: originalScript.editorial_profile_id,
        word_count: originalScript.word_count,
        estimated_duration: originalScript.estimated_duration,
        message_count: originalScript.message_count,
        version: 1
      })
      .select()
      .single();

    if (createError || !duplicatedScript) {
      console.error("❌ Error duplicating script:", createError);
      return errorResponseExpress(
        res,
        "Failed to duplicate script draft",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }

    return successResponseExpress(res, {
      message: "Script duplicated successfully",
      script: duplicatedScript
    });

  } catch (error) {
    console.error("❌ Script duplication error:", error);
    return errorResponseExpress(
      res,
      "Failed to duplicate script draft",
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

/**
 * POST /api/scripts/:id/generate-video
 * Generate video from existing script draft
 */
export async function generateVideoFromScriptHandler(req: Request, res: Response) {
  console.log("🎬 Starting video generation from script...");

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(authHeader);

    if (authError) {
      return errorResponseExpress(res, authError.error, authError.status);
    }

    const { id: scriptId } = req.params;

    // Fetch script draft
    const { data: scriptDraft, error: scriptError } = await supabase
      .from('script_drafts')
      .select('*')
      .eq('id', scriptId)
      .eq('user_id', user!.id)
      .single();

    if (scriptError || !scriptDraft) {
      return errorResponseExpress(
        res,
        "Script draft not found",
        HttpStatus.NOT_FOUND
      );
    }

    if (!scriptDraft.current_script?.trim()) {
      return errorResponseExpress(
        res,
        "Script is empty - cannot generate video",
        HttpStatus.BAD_REQUEST
      );
    }

    // Parse video generation request body
    const requestBody = req.body;
    
    // Create payload for video generation (copying from existing endpoint)
    const videoPayload = {
      prompt: scriptDraft.current_script, // Use script as prompt
      systemPrompt: "Generate video from provided script", // Simple system prompt
      selectedVideos: requestBody.selectedVideos || [],
      voiceId: requestBody.voiceId,
      captionConfig: requestBody.captionConfig,
      outputLanguage: scriptDraft.output_language || 'fr',
      editorialProfile: await getEditorialProfileForScript(user!.id, scriptDraft.editorial_profile_id),
    };

    // Validate video generation payload (reusing existing validation)
    const validationResult = VideoValidationService.validateRequest(videoPayload);
    if (!validationResult.success) {
      return errorResponseExpress(
        res,
        validationResult.error.message,
        validationResult.error.status,
        validationResult.error.details
      );
    }

    // Generate video using existing service (but with script as starting point)
    const videoGenerator = new VideoGeneratorService(user!);
    const result = await videoGenerator.generateVideoFromScript(
      scriptDraft,
      validationResult.payload
    );

    console.log("✅ Video generation from script initiated successfully");

    return successResponseExpress(res, {
      requestId: result.requestId,
      scriptId: result.scriptId, // Use result.scriptId (empty string for consistency)
      status: result.status,
      estimatedCompletionTime: result.estimatedCompletionTime,
    });

  } catch (error: any) {
    console.error("❌ Video generation from script error:", error);
    
    // Use same error handling pattern as original endpoint
    const statusCode = determineErrorStatusCode(error);
    
    return errorResponseExpress(
      res,
      error.message || "Failed to generate video from script",
      statusCode,
      process.env.NODE_ENV === "development"
        ? { stack: error.stack }
        : undefined
    );
  }
}

/**
 * Helper function to get editorial profile for script
 */
async function getEditorialProfileForScript(userId: string, profileId?: string) {
  if (profileId) {
    const { data: profile } = await supabase
      .from('editorial_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('user_id', userId)
      .single();
    
    if (profile) return profile;
  }

  // Fallback to user's default profile
  const { data: defaultProfile } = await supabase
    .from('editorial_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  return defaultProfile || {
    persona_description: 'Créateur de contenu professionnel',
    tone_of_voice: 'Conversationnel et amical',
    audience: 'Professionnels',
    style_notes: 'Communication claire et engageante',
  };
} 