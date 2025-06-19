import { Request, Response } from "express";
import { supabase } from "../../config/supabase";
import { ClerkAuthService } from "../../services/clerkAuthService";
import { ScriptChatService } from "../../services/script/chatService";
import {
  successResponseExpress,
  errorResponseExpress,
  HttpStatus,
} from "../../utils/api/responses";
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
      return errorResponseExpress(
        res,
        "Script draft not found",
        HttpStatus.NOT_FOUND
      );
    }

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