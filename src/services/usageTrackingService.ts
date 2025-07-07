import { supabase } from "../config/supabase";
// import { Database } from "../config/supabase-types";

type ResourceType =
  | "videos_generated"
  | "source_videos"
  | "voice_clones"
  | "account_analysis";

/**
 * Checks if a user has exceeded their limit for a specific resource.
 * @param userId The ID of the user.
 * @param resourceType The type of resource to check.
 * @returns Object indicating if the limit is reached and the current usage.
 */
export async function checkUsageLimit(
  userId: string,
  resourceType: "source_videos"
): Promise<{ limitReached: boolean; usage?: any }> {
  const { data: usage, error } = await supabase
    .from("user_usage")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    console.error(`Error fetching usage for user ${userId}:`, error);
    // Fail open, but log the error. The frontend should have caught this.
    return { limitReached: false };
  }

  if (!usage) {
    return { limitReached: true }; // Should not happen if user exists
  }

  const limitField = `${resourceType}_limit`;
  const usedField = `${resourceType}_used`;

  const limit = usage[limitField];
  const used = usage[usedField];

  return { limitReached: used >= limit, usage };
}

/**
 * Increments the usage for a specific resource.
 * @param userId The ID of the user.
 * @param resourceType The type of resource to increment.
 * @returns True if successful, false otherwise.
 */
export async function incrementUsage(
  userId: string,
  resourceType: "source_videos"
): Promise<boolean> {
  const usedField = `${resourceType}_used`;

  // TODO: Regenerate supabase types to remove 'as any' cast.
  // This is a workaround because the local Supabase environment (Docker) could not be reached.
  const { error } = await (supabase.rpc as any)("increment_user_usage", {
    p_user_id: userId,
    p_field_to_increment: usedField,
  });

  if (error) {
    console.error(
      `Failed to increment ${usedField} for user ${userId}:`,
      error
    );
    return false;
  }
  return true;
}

// We need a helper function in the DB to increment a dynamic field
// You need to run this SQL in your Supabase dashboard once:
/*
CREATE OR REPLACE FUNCTION increment_user_usage(p_user_id UUID, p_field_to_increment TEXT)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE public.user_usage SET %I = %I + 1, updated_at = now() WHERE user_id = %L',
                 p_field_to_increment, p_field_to_increment, p_user_id);
END;
$$ LANGUAGE plpgsql;
*/
