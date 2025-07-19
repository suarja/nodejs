import express from 'express';
import { 
  ClerkAuthService, 
  authenticateUser, 
  initializeEditiaCore 
} from 'editia-core';

// Initialize the package with real environment variables
console.log('🔧 Initializing editia-core package...');
try {
  initializeEditiaCore({
    clerkSecretKey: process.env.CLERK_SECRET_KEY!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
    environment: process.env.NODE_ENV || 'development'
  });
  console.log('✅ Package initialized successfully');
} catch (error) {
  console.error('❌ Package initialization failed:', error);
  process.exit(1);
}

const app = express();
const PORT = 3004;

// Middleware
app.use(express.json());

// Example 1: Using the middleware directly
app.get('/api/protected', authenticateUser, (req, res) => {
  res.json({
    success: true,
    message: 'Protected endpoint using middleware',
    user: {
      id: req.user?.id,
      email: req.user?.email
    }
  });
});

// Example 2: Using the service directly (like the current server does)
app.get('/api/auth-test', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { user, clerkUser, errorResponse } = await ClerkAuthService.verifyUser(authHeader);

    if (errorResponse) {
      return res.status(errorResponse.status).json(errorResponse);
    }

    res.json({
      success: true,
      message: 'Authentication successful using service directly',
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
    res.status(500).json({
      success: false,
      error: 'Internal server error during auth test',
      details: error?.message || 'Unknown error',
    });
  }
});

// Example 3: Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server running with editia-core package',
    package: 'editia-core',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Integration example server running at http://localhost:${PORT}`);
  console.log('');
  console.log('📍 Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  GET  /api/protected - Protected endpoint (middleware)');
  console.log('  GET  /api/auth-test - Auth test (direct service)');
  console.log('');
  console.log('🔐 To test authenticated endpoints, include:');
  console.log('  Authorization: Bearer <clerk-jwt-token>');
  console.log('');
  console.log('🧪 You can test with curl:');
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl -H "Authorization: Bearer <token>" http://localhost:${PORT}/api/protected`);
  console.log(`  curl -H "Authorization: Bearer <token>" http://localhost:${PORT}/api/auth-test`);
});

export default app; 