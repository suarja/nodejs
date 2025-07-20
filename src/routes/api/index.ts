import express from "express";
import { authenticateUser } from "editia-core";
import { uploadS3Handler } from "./s3Upload";
import {
  videoAnalysisHandler,
  videoAnalysisHealthHandler,
} from "./videoAnalysis";
import { videoDeleteHandler, videoDeleteHealthHandler } from "./videoDelete";
import { generateVideoHandler, getVideoStatusHandler } from "./videos";
import {
  saveSourceVideoHandler,
  getSourceVideosHandler,
  updateSourceVideoHandler,
} from "./sourceVideos";
import {
  getScriptDraftsHandler,
  getScriptDraftHandler,
  scriptChatHandler,
  validateScriptHandler,
  deleteScriptDraftHandler,
  duplicateScriptDraftHandler,
  generateVideoFromScriptHandler,
  modifyCurrentScriptHandler,
} from "./scripts";
import promptsRouter from "./prompts";
import webhooksRouter from "./webhooks";
import voiceCloneRouter from "./voiceClone";
import onboardingRouter from "./onboarding";
import supportRouter from "./support";
import { usageLimiter } from "../../middleware/usageLimitMiddleware";
import { ResourceType } from "../../types/ressource";
import userManagementRouter from "./userManagement";

const apiRouter = express.Router();

// ============================================================================
// PUBLIC ENDPOINTS (No authentication required)
// ============================================================================

// Health check endpoint
apiRouter.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// Auth test endpoint for debugging
apiRouter.get("/auth-test", async (req, res) => {
  try {
    console.log("🧪 Auth test endpoint called");
    console.log("🔍 Headers received:", JSON.stringify(req.headers, null, 2));

    const authHeader = req.headers.authorization;
    console.log("🔍 Authorization header:", authHeader ? "Present" : "Missing");

    if (!authHeader) {
      return res.status(400).json({
        success: false,
        error: "No Authorization header provided",
        hint: "Include Authorization: Bearer <clerk-jwt-token> in your request",
      });
    }

    // Use editia-core ClerkAuthService
    const { ClerkAuthService } = await import("editia-core");
    const { user, clerkUser, errorResponse } =
      await ClerkAuthService.verifyUser(authHeader);

    if (errorResponse) {
      return res.status(errorResponse.status).json(errorResponse);
    }

    return res.status(200).json({
      success: true,
      message: "Authentication successful!",
      data: {
        clerkUser: {
          id: clerkUser?.id,
          email: clerkUser?.emailAddresses[0]?.emailAddress,
        },
        databaseUser: {
          id: user?.id,
          email: user?.email,
          full_name: user?.full_name,
        },
      },
    });
  } catch (error: any) {
    console.error("❌ Auth test error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during auth test",
      details: error?.message || "Unknown error",
    });
  }
});

// Test endpoint for streaming (NO AUTH)
apiRouter.post("/test/streaming", async (req, res) => {
  console.log("🧪 Test streaming endpoint called");

  try {
    const isStreaming = req.body.streaming === true;

    if (isStreaming) {
      // Set up streaming response
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Send test streaming data
      res.write('data: {"type": "message_start"}\n\n');

      await new Promise((resolve) => setTimeout(resolve, 100));
      res.write('data: {"type": "content_delta", "content": "Bonjour! "}\n\n');

      await new Promise((resolve) => setTimeout(resolve, 100));
      res.write(
        'data: {"type": "content_delta", "content": "Ceci est un test de streaming."}\n\n'
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
      res.write('data: {"type": "message_complete"}\n\n');

      res.end();
    } else {
      res.json({
        success: true,
        message: "Test endpoint working",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("❌ Test streaming error:", error);
    res.status(500).json({ success: false, error: "Test failed" });
  }
});

// Webhook endpoints (typically don't require auth)
apiRouter.use("/webhooks", webhooksRouter);

// ============================================================================
// AUTHENTICATED ENDPOINTS (Require authentication)
// ============================================================================

// Create authenticated router with middleware
const authRoutes = express.Router();

// Apply authentication middleware to all routes in this router
authRoutes.use(authenticateUser);

// S3 upload endpoint
authRoutes.post("/s3-upload", uploadS3Handler);

// Video analysis endpoints
authRoutes.post("/video-analysis", videoAnalysisHandler);
authRoutes.get("/video-analysis/health", videoAnalysisHealthHandler);

// Video deletion endpoints
authRoutes.delete("/videos", videoDeleteHandler);
authRoutes.get("/video-delete/health", videoDeleteHealthHandler);

// Source videos endpoints
authRoutes.post("/source-videos", saveSourceVideoHandler);
authRoutes.get("/source-videos", getSourceVideosHandler);
authRoutes.put("/source-videos/:videoId", updateSourceVideoHandler);

// Video generation endpoints
authRoutes.post(
  "/videos/generate",
  usageLimiter(ResourceType.VIDEOS_GENERATED),
  generateVideoHandler
);
authRoutes.get("/videos/status/:id", getVideoStatusHandler);

// Script chat endpoints
authRoutes.get("/scripts", getScriptDraftsHandler);
authRoutes.get("/scripts/:id", getScriptDraftHandler);
authRoutes.post("/scripts/chat", scriptChatHandler);
authRoutes.post("/scripts/:id/validate", validateScriptHandler);
authRoutes.delete("/scripts/:id", deleteScriptDraftHandler);
authRoutes.post("/scripts/:id/duplicate", duplicateScriptDraftHandler);
authRoutes.post("/scripts/generate-video/:id", generateVideoFromScriptHandler);
authRoutes.post(
  "/scripts/modify-current-script/:id",
  modifyCurrentScriptHandler
);

// Prompt enhancement endpoints
authRoutes.use("/prompts", promptsRouter);

// Voice clone endpoints
authRoutes.use("/voice-clone", voiceCloneRouter);

// Onboarding endpoints
authRoutes.use("/onboarding", onboardingRouter);

// Support endpoints
authRoutes.use("/support", supportRouter);

// User management endpoints
authRoutes.use("/user-management", userManagementRouter);

// List video requests endpoint (simplified - no manual auth needed)
authRoutes.get("/videos", async (req, res) => {
  try {
    // User is already authenticated by middleware, available as req.user
    const userId = req.user!.id;

    // Get the user's video requests (latest first)
    const { data: videoRequests, error } = await (
      await import("../../config/supabase")
    ).supabase
      .from("video_requests")
      .select("id, status, created_at, payload, result_data, error_message")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("❌ Failed to fetch video requests:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch video requests",
      });
    }

    return res.status(200).json({
      success: true,
      data: videoRequests || [],
    });
  } catch (error) {
    console.error("❌ List videos error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Mount authenticated routes
apiRouter.use("/", authRoutes);

export default apiRouter;
