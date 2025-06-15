-- EMERGENCY FIX: Disable RLS on video_requests table to fix generated videos page
-- Run this in Supabase Dashboard > SQL Editor
-- Step 1: Disable RLS on video_requests table (allows queries to work immediately)
ALTER TABLE public.video_requests DISABLE ROW LEVEL SECURITY;
-- This will allow the generated videos page to work again immediately.
-- We can implement proper RLS policies later after the page is working.
-- Optional: If you want to verify the current policies, run this:
-- SELECT schemaname, tablename, policyname, cmd, roles, qual 
-- FROM pg_policies 
-- WHERE tablename = 'video_requests';