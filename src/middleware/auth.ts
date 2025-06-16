import { Request, Response, NextFunction } from "express";
import { ClerkAuthService } from "../services/clerkAuthService";

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

    // Use AuthService to verify user (matches mobile app implementation)
    const { user, errorResponse } = await ClerkAuthService.verifyUser(
      authHeader
    );

    if (errorResponse) {
      res.status(errorResponse.status).json(errorResponse);
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
    console.error("❌ Authentication middleware error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication service error",
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

    // Use AuthService to verify user if header is present
    const { user, errorResponse } = await ClerkAuthService.verifyUser(
      authHeader
    );

    if (!errorResponse && user) {
      req.user = {
        id: user.id,
        email: user.email,
        ...user.user_metadata,
      };
      console.log(`🔐 Optional auth successful: ${user.email} (${user.id})`);
    }

    next();
  } catch (error) {
    console.error("❌ Optional auth error:", error);
    // Continue without authentication for optional auth
    next();
  }
}
