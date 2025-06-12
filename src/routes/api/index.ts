import express from "express";
import { ClerkAuthService } from "../../services/clerkAuthService";
import { uploadS3Handler } from "./s3Upload";
import { generateVideoHandler, getVideoStatusHandler } from "./videos";
import { 
  saveSourceVideoHandler, 
  getSourceVideosHandler, 
  updateSourceVideoHandler 
} from "./sourceVideos";
import promptsRouter from "./prompts";
import webhooksRouter from "./webhooks";
import voiceCloneRouter from "./voiceClone";
import onboardingRouter from "./onboarding";

const apiRouter = express.Router();

// Health check endpoint
apiRouter.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
  });
});

// S3 upload endpoint (auth handled in the handler)
apiRouter.post("/s3-upload", uploadS3Handler);

// Source videos endpoints (auth handled in the handlers)
apiRouter.post("/source-videos", saveSourceVideoHandler);
apiRouter.get("/source-videos", getSourceVideosHandler);
apiRouter.put("/source-videos/:videoId", updateSourceVideoHandler);

// Video generation endpoints (auth handled in the handlers)
apiRouter.post("/videos/generate", generateVideoHandler);
apiRouter.get("/videos/status/:id", getVideoStatusHandler);

// Prompt enhancement endpoints
apiRouter.use("/prompts", promptsRouter);

// Webhook endpoints
apiRouter.use("/webhooks", webhooksRouter);

// Voice clone endpoints
apiRouter.use("/voice-clone", voiceCloneRouter);

// Onboarding endpoints
apiRouter.use("/onboarding", onboardingRouter);

// List video requests endpoint (updated to use ClerkAuthService)
apiRouter.get("/videos", async (req, res) => {
  try {
    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(
      authHeader
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    // Get the user's video requests (latest first)
    const { data: videoRequests, error } = await (
      await import("../../config/supabase")
    ).supabase
      .from("video_requests")
      .select("id, status, created_at, payload, result_data, error_message")
      .eq("user_id", user!.id) // Use database user ID
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

export default apiRouter;
