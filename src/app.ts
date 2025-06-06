import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import indexRouter from './routes/index';
import { testSupabaseConnection } from './config/supabase';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../public')));

// Parse JSON bodies
app.use(express.json());

// Use the router for handling routes
app.use('/', indexRouter);

// Catch-all route for handling 404 errors
app.use((req, res, next) => {
  res.status(404).sendFile(path.join(__dirname, '../views', '404.html'));
});

// Start server with Supabase connection test
async function startServer() {
  try {
    console.log('🔧 Testing Supabase connection...');
    const isSupabaseConnected = await testSupabaseConnection();

    if (!isSupabaseConnected) {
      console.warn(
        '⚠️  Supabase connection failed, but server will continue...'
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
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
