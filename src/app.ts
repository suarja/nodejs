import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import indexRouter from "./routes/index";
import apiRouter from "./routes/api";
import { supabase, testSupabaseConnection } from "./config/supabase";
import { testS3Connection } from "./config/aws";
import { AgentService } from "./services/agentService";
import { logger, logtail } from "./config/logger";
import { authenticateUser, ClerkAuthService, MonetizationService } from "editia-core";

// Load environment variables
dotenv.config();

const environment = process.env.NODE_ENV as "development" | "production" | "test" || 'development';
// Initialize Editia Core package
try {
  ClerkAuthService.initialize({
    clerkSecretKey: process.env.CLERK_SECRET_KEY!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    environment
  });
  MonetizationService.initialize({
    supabaseClient: supabase,
    environment
  });
  logger.info("✅ Editia Core package initialized successfully");
} catch (error) {
  logger.error("❌ Failed to initialize Editia Core package:", error);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "../public")));

// Parse JSON bodies
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Middleware to log requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});
// API routes
app.use("/api", apiRouter);

// Web routes
app.use("/", indexRouter);

// Catch-all route for handling 404 errors
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
  });
});

// Error handling middleware
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    logger.error("❌ Server error:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      ...(process.env.NODE_ENV === "development" && { details: error.message }),
    });
  }
);

// Start server with all service connection tests
async function startServer() {
  try {
    logger.info("🔧 Testing service connections...");

    // Test Supabase connection
    const isSupabaseConnected = await testSupabaseConnection();

    // Test S3 connection
    const isS3Connected = await testS3Connection();

    // Test Agent services
    const agentService = AgentService.getInstance();
    const areAgentsConnected = await agentService.testConnections();

    if (!isSupabaseConnected) {
      logger.warn(
        "⚠️  Supabase connection failed, but server will continue..."
      );
    }

    if (!isS3Connected) {
      logger.warn("⚠️  S3 connection failed, but server will continue...");
    }

    if (!areAgentsConnected) {
      logger.warn(
        "⚠️  Agent services connection failed, but server will continue..."
      );
    }

    app.listen(PORT, () => {
      logger.info(`🚀 Server running at http://localhost:${PORT}/`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(
        `🔌 Supabase: ${
          isSupabaseConnected ? "✅ Connected" : "❌ Disconnected"
        }`
      );
      logger.info(
        `📦 S3: ${isS3Connected ? "✅ Connected" : "❌ Disconnected"}`
      );
      logger.info(
        `🤖 Agents: ${areAgentsConnected ? "✅ Connected" : "❌ Disconnected"}`
      );
      logger.info("🎯 Server ready for video generation API requests");
      logger.info("");
      logger.info("📍 Available API endpoints:");
      logger.info("  GET  /api/health");
      logger.info("  GET  /api/auth-test (🧪 Debug Clerk authentication)");
      logger.info("  POST /api/s3-upload");
      logger.info("  POST /api/source-videos");
      logger.info("  GET  /api/source-videos");
      logger.info("  PUT  /api/source-videos/:videoId");
      logger.info("  POST /api/videos/generate");
      logger.info("  GET  /api/videos/status/:id");
      logger.info("  GET  /api/videos");
      logger.info("  GET  /api/scripts (📝 List script drafts)");
      logger.info("  GET  /api/scripts/:id (📄 Get specific script)");
      logger.info("  POST /api/scripts/chat (💬 Script chat with streaming)");
      logger.info("  POST /api/scripts/:id/validate (✅ Validate script)");
      logger.info("  DELETE /api/scripts/:id (🗑️ Delete script)");
      logger.info("  POST /api/scripts/:id/duplicate (📋 Duplicate script)");
      logger.info(
        "  POST /api/scripts/:id/generate-video (🎬 Generate video from script)"
      );
      logger.info("");
      logger.info(
        "🔐 Authentication: All endpoints (except /health) require Clerk JWT token"
      );
      logger.info("📝 Header format: Authorization: Bearer <clerk-jwt-token>");
      logtail.flush();
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    logtail.flush();
    process.exit(1);
  }
}

startServer();

export default app;
