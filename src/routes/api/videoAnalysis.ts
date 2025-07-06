import { Request, Response } from "express";
import {
  geminiService,
  GeminiAnalysisResponse,
} from "../../services/geminiService";
import { ClerkAuthService } from "../../services/clerkAuthService";

export async function videoAnalysisHandler(req: Request, res: Response) {
  try {
    console.log("🧠 Video analysis request received");

    // Step 1: Authenticate user using ClerkAuthService
    const authHeader = req.headers.authorization;
    const {
      user,
      clerkUser,
      errorResponse: authError,
    } = await ClerkAuthService.verifyUser(authHeader);
    console.log(
      "🔐 User authenticated for video analysis - DB ID:",
      user?.id,
      "Clerk ID:",
      clerkUser?.id
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { s3Key, fileName, fileSize } = req.body;

    // Validate required fields
    if (!s3Key || !fileName || !fileSize) {
      return res.status(400).json({
        success: false,
        error: "s3Key, fileName, and fileSize are required",
      });
    }

    // Validate file size (max 100MB)
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (fileSize > maxFileSize) {
      return res.status(400).json({
        success: false,
        error: "File size too large. Maximum size is 100MB.",
      });
    }

    console.log(
      `📤 Starting video analysis for user ${
        user!.id
      }: ${fileName} (${fileSize} bytes)`
    );

    // Step 2: Analyze video with Gemini
    const analysisResult: GeminiAnalysisResponse =
      await geminiService.analyzeVideoFromS3(s3Key, fileName, fileSize);

    if (!analysisResult.success) {
      console.error(
        `❌ Video analysis failed for user ${user!.id}:`,
        analysisResult.error
      );
      return res.status(500).json({
        success: false,
        error: analysisResult.error || "Video analysis failed",
        analysis_time: analysisResult.analysis_time,
      });
    }

    console.log(
      `✅ Video analysis completed for user ${user!.id} in ${
        analysisResult.analysis_time
      }ms`
    );

    // Step 3: Return analysis results
    return res.status(200).json({
      success: true,
      data: {
        analysis_data: analysisResult.data,
        analysis_time: analysisResult.analysis_time,
        method_used: analysisResult.method_used,
      },
    });
  } catch (error) {
    console.error("❌ Video analysis endpoint error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during video analysis",
    });
  }
}

/**
 * Health check endpoint for video analysis service
 */
export async function videoAnalysisHealthHandler(req: Request, res: Response) {
  try {
    console.log("🏥 Video analysis health check requested");

    // Test Gemini service connection
    const isHealthy = await geminiService.testConnection();

    if (!isHealthy) {
      return res.status(503).json({
        success: false,
        error: "Gemini service is not available",
        service: "video-analysis",
        status: "unhealthy",
      });
    }

    return res.status(200).json({
      success: true,
      service: "video-analysis",
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Video analysis health check failed:", error);
    return res.status(503).json({
      success: false,
      error: "Health check failed",
      service: "video-analysis",
      status: "unhealthy",
    });
  }
}
