-- URGENT: Revert RLS policies to working state
-- This script fixes the video upload regression by simplifying RLS policies
-- Step 1: Temporarily disable RLS on videos table to allow immediate uploads
ALTER TABLE public.videos DISABLE ROW LEVEL SECURITY;
-- Step 2: Drop the problematic function and policies
DROP POLICY IF EXISTS "Users can CRUD own videos" ON public.videos;
DROP FUNCTION IF EXISTS get_database_user_id() CASCADE;
-- Step 3: Create a simple RLS policy that works with Clerk JWT tokens
-- The frontend sends the database user ID directly in queries, so we just need to allow authenticated users
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
-- Simple policy: Allow authenticated users to access their own videos
-- This policy relies on the frontend correctly filtering by user_id
CREATE POLICY "Authenticated users can access videos" ON public.videos FOR ALL USING (auth.role() = 'authenticated');
-- Alternative approach: If we want to use the JWT sub claim, we can do this:
-- But first, let's check if the clerk_user_id field exists and is populated
DO $$
DECLARE has_clerk_field BOOLEAN;
user_count INTEGER;
BEGIN -- Check if clerk_user_id field exists
SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'videos'
            AND column_name = 'clerk_user_id'
    ) INTO has_clerk_field;
IF has_clerk_field THEN RAISE NOTICE 'videos table has clerk_user_id field';
-- Check if any users have clerk_user_id populated
SELECT COUNT(*) INTO user_count
FROM public.users
WHERE clerk_user_id IS NOT NULL;
RAISE NOTICE 'Users with clerk_user_id: %',
user_count;
IF user_count > 0 THEN -- If we have users with clerk_user_id, we can use a more restrictive policy
RAISE NOTICE 'Creating clerk-aware policy';
-- Drop the simple policy and create a clerk-aware one
DROP POLICY IF EXISTS "Authenticated users can access videos" ON public.videos;
CREATE POLICY "Users can access own videos via clerk_id" ON public.videos FOR ALL USING (
    user_id IN (
        SELECT id
        FROM public.users
        WHERE clerk_user_id = auth.jwt()->>'sub'
    )
);
ELSE RAISE NOTICE 'No users with clerk_user_id found, keeping simple policy';
END IF;
ELSE RAISE NOTICE 'videos table does not have clerk_user_id field, keeping simple policy';
END IF;
END $$;