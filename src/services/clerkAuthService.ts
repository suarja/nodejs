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
    console.log(
      "🔍 ClerkAuthService.verifyUser called with header:",
      authHeader ? "Present" : "Missing"
    );

    // Check if auth header exists
    if (!authHeader) {
      console.log("❌ No authorization header provided");
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
    console.log("🔍 Extracted token length:", token.length);
    console.log("🔍 Token preview:", token.substring(0, 50) + "...");

    // Basic JWT format validation
    const jwtParts = token.split(".");
    console.log("🔍 JWT parts count:", jwtParts.length);

    if (jwtParts.length !== 3) {
      console.log(
        "❌ Invalid JWT format - should have 3 parts separated by dots"
      );
      return {
        user: null,
        clerkUser: null,
        errorResponse: {
          success: false,
          error:
            "Invalid JWT format - token should have 3 parts separated by dots",
          status: 401,
        },
      };
    }

    try {
      console.log("🔍 Attempting to verify token with Clerk...");

      // Verify JWT token with Clerk using the standalone verifyToken function
      const verifiedToken = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });

      console.log(
        "✅ Token verified successfully:",
        verifiedToken ? "Valid" : "Invalid"
      );

      if (!verifiedToken || !verifiedToken.sub) {
        console.log("❌ Token verification failed - no sub claim");
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

      console.log("🔍 Clerk user ID from token:", verifiedToken.sub);

      // Get Clerk user details using the user ID from the token
      const clerkUser = await this.clerkClient.users.getUser(verifiedToken.sub);

      if (!clerkUser) {
        console.log("❌ Clerk user not found for ID:", verifiedToken.sub);
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

      console.log(
        "✅ Clerk user found:",
        clerkUser.id,
        clerkUser.emailAddresses[0]?.emailAddress
      );

      // Get database user using Clerk user ID
      console.log(
        "🔍 Looking up database user with clerk_user_id:",
        clerkUser.id
      );

      const { data: databaseUser, error: dbError } = await supabase
        .from("users")
        .select("id, email, full_name, avatar_url, role, clerk_user_id")
        .eq("clerk_user_id", clerkUser.id)
        .single();

      if (dbError || !databaseUser) {
        console.error("❌ Database user lookup error:", dbError);
        console.log(
          "🔍 This might mean the user needs to complete onboarding to create database record"
        );
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
    } catch (error: any) {
      console.error("❌ Clerk auth service error:", error);
      console.error("❌ Error details:", {
        name: error?.name || "Unknown",
        message: error?.message || "Unknown error",
        token: token.substring(0, 50) + "...",
      });

      return {
        user: null,
        clerkUser: null,
        errorResponse: {
          success: false,
          error:
            "Authentication service error: " +
            (error?.message || "Unknown error"),
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
