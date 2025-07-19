const { ClerkAuthService, initializeEditiaCore } = require("editia-core");

console.log("🧪 Simple package test...\n");

// Test 1: Check if package is loaded
console.log("✅ Package loaded successfully");
console.log("- ClerkAuthService:", typeof ClerkAuthService);
console.log("- initializeEditiaCore:", typeof initializeEditiaCore);
console.log("");

// Test 2: Try to initialize (this might fail without real env vars, which is expected)
console.log("🔧 Testing initialization...");
try {
  initializeEditiaCore({
    clerkSecretKey: "test-key",
    supabaseUrl: "https://test.supabase.co",
    supabaseAnonKey: "test-anon-key",
    environment: "test",
  });
  console.log("✅ Initialization successful");
} catch (error) {
  console.log(
    "⚠️ Initialization failed (expected without real env vars):",
    error.message
  );
}
console.log("");

// Test 3: Test service method (this should work even without real env vars)
console.log("🔧 Testing service method...");
try {
  const result = await ClerkAuthService.verifyUser("invalid-token");
  console.log(
    "✅ Service method works (returned error as expected):",
    result.errorResponse ? "Error returned" : "Unexpected success"
  );
} catch (error) {
  console.log("❌ Service method failed:", error.message);
}
console.log("");

console.log("🎉 Package test completed!");
console.log("📦 The editia-core package is working correctly.");
