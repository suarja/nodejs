import { supabase } from '../config/supabase';

export interface AuthResult {
  user: any | null;
  errorResponse: any | null;
}

/**
 * Authentication service matching the mobile app implementation
 */
export class AuthService {
  /**
   * Verifies user from an authorization header
   * @param authHeader The Authorization header value
   * @returns Object containing user or error response
   */
  static async verifyUser(authHeader?: string | null): Promise<AuthResult> {
    // Check if auth header exists
    if (!authHeader) {
      return {
        user: null,
        errorResponse: {
          success: false,
          error: 'Missing authorization header',
          status: 401,
        },
      };
    }

    // Get token from header
    const token = authHeader.replace('Bearer ', '');

    try {
      // Verify token with Supabase
      const { data, error } = await supabase.auth.getUser(token);

      if (error) {
        console.error('❌ Auth error:', error);
        return {
          user: null,
          errorResponse: {
            success: false,
            error: 'Invalid authentication token',
            status: 401,
          },
        };
      }

      if (!data.user) {
        return {
          user: null,
          errorResponse: {
            success: false,
            error: 'Unauthorized',
            status: 401,
          },
        };
      }

      console.log(`🔐 User verified: ${data.user.email} (${data.user.id})`);

      // Return user data
      return {
        user: data.user,
        errorResponse: null,
      };
    } catch (error) {
      console.error('❌ Auth service error:', error);
      return {
        user: null,
        errorResponse: {
          success: false,
          error: 'Authentication service error',
          status: 500,
        },
      };
    }
  }
}
