const express = require("express");
const {
  ClerkAuthService,
  authenticateUser,
  initializeEditiaCore,
} = require("editia-core");

// Initialize the package (this would normally use real env vars)
console.log("🔧 Initializing editia-core package...");
try {
  initializeEditiaCore({
    clerkSecretKey: process.env.CLERK_SECRET_KEY || "test-key",
    supabaseUrl: process.env.SUPABASE_URL || "https://test.supabase.co",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "test-anon-key",
    environment: "test",
  });
  console.log("✅ Package initialized successfully");
} catch (error) {
  console.log(
    "⚠️ Package initialization failed (expected in test):",
    error.message
  );
}

const app = express();
const PORT = 3003;

// Middleware
app.use(express.json());

// Test endpoint without authentication
app.get("/test/public", (req, res) => {
  res.json({
    success: true,
    message: "Public endpoint working",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint with authentication
app.get("/test/auth", authenticateUser, (req, res) => {
  res.json({
    success: true,
    message: "Authenticated endpoint working",
    user: {
      id: req.user?.id,
      email: req.user?.email,
    },
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint using ClerkAuthService directly
app.get("/test/service", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { user, clerkUser, errorResponse } =
      await ClerkAuthService.verifyUser(authHeader);

    if (errorResponse) {
      return res.status(errorResponse.status).json(errorResponse);
    }

    res.json({
      success: true,
      message: "Service endpoint working",
      user: user
        ? {
            id: user.id,
            email: user.email,
          }
        : null,
      clerkUser: clerkUser
        ? {
            id: clerkUser.id,
            email: clerkUser.emailAddresses[0]?.emailAddress,
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Service error",
      details: error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Test server running",
    package: "editia-core",
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Test server running at http://localhost:${PORT}`);
  console.log("");
  console.log("📍 Available test endpoints:");
  console.log("  GET  /health - Health check");
  console.log("  GET  /test/public - Public endpoint (no auth)");
  console.log("  GET  /test/auth - Authenticated endpoint (requires auth)");
  console.log("  GET  /test/service - Service endpoint (direct service usage)");
  console.log("");
  console.log("🔐 To test authenticated endpoints, include:");
  console.log("  Authorization: Bearer <clerk-jwt-token>");
  console.log("");
  console.log("🧪 You can test with curl:");
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl http://localhost:${PORT}/test/public`);
  console.log(
    `  curl -H "Authorization: Bearer <token>" http://localhost:${PORT}/test/auth`
  );
  console.log(
    `  curl -H "Authorization: Bearer <token>" http://localhost:${PORT}/test/service`
  );
});
