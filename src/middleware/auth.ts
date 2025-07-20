import { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger";
import { ClerkAuthService, DatabaseUser } from "editia-core";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: DatabaseUser;
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
    logger.info(`🔐 Authenticating user with auth header: ${authHeader}`);
    // Use AuthService to verify user (matches mobile app implementation)
    const { user, errorResponse } = await ClerkAuthService.verifyUser(
      authHeader
    );

    if (errorResponse || !user) {
      res.status(errorResponse?.status || 500).json(errorResponse);
      return;
    }

    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email || "",
      clerk_user_id: user.clerk_user_id || "",
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

    if (errorResponse || !user) {
      res.status(errorResponse?.status || 500).json(errorResponse);
      return;
    }

    req.user = {
      id: user.id,
      email: user.email || "",
      clerk_user_id: user.clerk_user_id || "",
    };
    console.log(`🔐 Optional auth successful: ${user.email} (${user.id})`);

    next();
  } catch (error) {
    console.error("❌ Optional auth error:", error);
    // Continue without authentication for optional auth
    next();
  }
}
