import { createClerkClient, verifyToken } from "@clerk/backend";
import { supabase } from "../config/supabase";

export interface ClerkAuthResult {
  user: any | null;
  clerkUser: any | null;
  errorResponse: any | null;
}

/**
 * Clerk authentication service for backend API
 */
export class ClerkAuthService {
  private static clerkClient = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY!,
  });

  /**
   * Verifies user from a Clerk JWT token and returns both Clerk user and database user
   * @param authHeader The Authorization header value containing Clerk JWT
   * @returns Object containing Clerk user, database user, or error response
   */
  static async verifyUser(
    authHeader?: string | null
  ): Promise<ClerkAuthResult> {
    // Check if auth header exists
    if (!authHeader) {
      return {
        user: null,
        clerkUser: null,
        errorResponse: {
          success: false,
          error: "Missing authorization header",
          status: 401,
        },
      };
    }

    // Get token from header
    const token = authHeader.replace("Bearer ", "");

    try {
      // Verify JWT token with Clerk using the standalone verifyToken function
      const verifiedToken = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      if (!verifiedToken || !verifiedToken.sub) {
        return {
          user: null,
          clerkUser: null,
          errorResponse: {
            success: false,
            error: "Invalid authentication token",
            status: 401,
          },
        };
      }

      // Get Clerk user details using the user ID from the token
      const clerkUser = await this.clerkClient.users.getUser(verifiedToken.sub);

      if (!clerkUser) {
        return {
          user: null,
          clerkUser: null,
          errorResponse: {
            success: false,
            error: "Clerk user not found",
            status: 401,
          },
        };
      }

      // Get database user using Clerk user ID
      const { data: databaseUser, error: dbError } = await supabase
        .from("users")
        .select("id, email, full_name, avatar_url, role, clerk_user_id")
        .eq("clerk_user_id", clerkUser.id)
        .single();

      if (dbError || !databaseUser) {
        console.error("❌ Database user lookup error:", dbError);
        return {
          user: null,
          clerkUser: clerkUser,
          errorResponse: {
            success: false,
            error: "Database user not found. Please complete onboarding.",
            status: 404,
          },
        };
      }

      console.log(
        `🔐 User verified: ${clerkUser.emailAddresses[0]?.emailAddress} (Clerk: ${clerkUser.id}, DB: ${databaseUser.id})`
      );

      // Return both Clerk user and database user
      return {
        user: databaseUser, // Database user with database ID
        clerkUser: clerkUser, // Clerk user with Clerk details
        errorResponse: null,
      };
    } catch (error) {
      console.error("❌ Clerk auth service error:", error);
      return {
        user: null,
        clerkUser: null,
        errorResponse: {
          success: false,
          error: "Authentication service error",
          status: 500,
        },
      };
    }
  }

  /**
   * Helper method to get just the database user ID from a Clerk token
   * @param authHeader The Authorization header value containing Clerk JWT
   * @returns Database user ID or null
   */
  static async getDatabaseUserId(
    authHeader?: string | null
  ): Promise<string | null> {
    const { user } = await this.verifyUser(authHeader);
    return user?.id || null;
  }
}
