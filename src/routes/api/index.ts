import express from "express";
import { ClerkAuthService } from "../../services/clerkAuthService";
import { uploadS3Handler } from "./s3Upload";
import { generateVideoHandler, getVideoStatusHandler } from "./videos";
import {
  saveSourceVideoHandler,
  getSourceVideosHandler,
  updateSourceVideoHandler,
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
    const { user, errorResponse: authError } =
      await ClerkAuthService.verifyUser(authHeader);

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
