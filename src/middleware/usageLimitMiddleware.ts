import { Request, Response, NextFunction } from "express";
import { ClerkAuthService } from "../services/clerkAuthService";
import {
  checkUsageLimit,
  incrementUsage,
} from "../services/usageTrackingService";

type ResourceType = "source_videos" | "voice_clones" | "videos_generated"; // Add other resources as needed

export function usageLimiter(resourceType: ResourceType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // 1. Authenticate user
    const { user, errorResponse } = await ClerkAuthService.verifyUser(
      authHeader
    );

    if (errorResponse) {
      return res.status(errorResponse.status).json(errorResponse);
    }

    // 2. Check usage limit
    const { limitReached, usage } = await checkUsageLimit(
      user.id,
      resourceType
    );

    if (limitReached) {
      return res.status(429).json({
        success: false,
        error: `Usage limit reached for ${resourceType}.`,
        details: {
          limit: (usage as any)[`${resourceType}_limit`],
          used: (usage as any)[`${resourceType}_used`],
        },
      });
    }

    // Attach user to request for subsequent handlers
    (req as any).user = user;

    next();
  };
}

// Optional: A middleware to increment usage AFTER a successful operation.
// This would be used at the end of a route handler.
export async function incrementResourceUsage(
  userId: string,
  resourceType: ResourceType
) {
  await incrementUsage(userId, resourceType);
}
