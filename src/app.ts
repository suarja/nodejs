import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import cors from 'cors';
import indexRouter from './routes/index';
import apiRouter from './routes/api';
import { testSupabaseConnection } from './config/supabase';
import { testS3Connection } from './config/aws';
import { AgentService } from './services/agentService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../public')));

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
// API routes
app.use('/api', apiRouter);

// Web routes
app.use('/', indexRouter);

// Catch-all route for handling 404 errors
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
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
    console.error('❌ Server error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { details: error.message }),
    });
  }
);

// Start server with all service connection tests
async function startServer() {
  try {
    console.log('🔧 Testing service connections...');

    // Test Supabase connection
    const isSupabaseConnected = await testSupabaseConnection();

    // Test S3 connection
    const isS3Connected = await testS3Connection();

    // Test Agent services
    const agentService = AgentService.getInstance();
    const areAgentsConnected = await agentService.testConnections();

    if (!isSupabaseConnected) {
      console.warn(
        '⚠️  Supabase connection failed, but server will continue...'
      );
    }

    if (!isS3Connected) {
      console.warn('⚠️  S3 connection failed, but server will continue...');
    }

    if (!areAgentsConnected) {
      console.warn(
        '⚠️  Agent services connection failed, but server will continue...'
      );
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}/`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(
        `🔌 Supabase: ${
          isSupabaseConnected ? '✅ Connected' : '❌ Disconnected'
        }`
      );
      console.log(
        `📦 S3: ${isS3Connected ? '✅ Connected' : '❌ Disconnected'}`
      );
      console.log(
        `🤖 Agents: ${areAgentsConnected ? '✅ Connected' : '❌ Disconnected'}`
      );
      console.log('🎯 Server ready for video generation API requests');
      console.log('');
      console.log('📍 Available API endpoints:');
      console.log('  GET  /api/health');
      console.log('  POST /api/s3-upload');
      console.log('  POST /api/videos/generate');
      console.log('  GET  /api/videos/status/:id');
      console.log('  GET  /api/videos');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
