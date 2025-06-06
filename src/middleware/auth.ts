import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        [key: string]: any;
      };
    }
  }
}

export async function authenticateUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('❌ Authentication failed:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
      return;
    }

    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      ...user.user_metadata,
    };

    console.log(`🔐 User authenticated: ${user.email} (${user.id})`);
    next();
  } catch (error) {
    console.error('❌ Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication service error',
    });
  }
}

// Optional authentication (for endpoints that work with or without auth)
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (!error && user) {
        req.user = {
          id: user.id,
          email: user.email,
          ...user.user_metadata,
        };
        console.log(`🔐 Optional auth successful: ${user.email} (${user.id})`);
      }
    }

    next();
  } catch (error) {
    console.error('❌ Optional auth error:', error);
    // Continue without authentication for optional auth
    next();
  }
}
