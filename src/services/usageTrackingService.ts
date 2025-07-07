import { supabase } from "../config/supabase";

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
  resourceType: "source_videos" | "voice_clones" | "videos_generated"
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

  const limit = usage[limitField as keyof typeof usage];
  const used = usage[usedField as keyof typeof usage];

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
  resourceType: "source_videos" | "voice_clones" | "videos_generated"
): Promise<boolean> {
  const usedField = `${resourceType}_used`;

  // The custom RPC function 'increment_user_usage' is not currently reflected
  // in the auto-generated Supabase types. To avoid unsafe "read-then-write"
  // manual increments which can cause race conditions, we call the atomic
  // RPC function directly. The 'as any' cast is a temporary workaround
  // for this type generation issue and does not affect runtime correctness.
  const { error } = await supabase.rpc("increment_user_usage", {
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
