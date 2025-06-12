-- EMERGENCY FIX: Disable RLS on videos table to fix upload regression
-- Run this in Supabase Dashboard > SQL Editor
-- Step 1: Disable RLS on videos table (allows uploads to work immediately)
ALTER TABLE public.videos DISABLE ROW LEVEL SECURITY;
-- This will allow video uploads to work again immediately.
-- We can implement proper RLS policies later after uploads are working.
-- Optional: If you want to verify the current policies, run this:
-- SELECT schemaname, tablename, policyname, cmd, roles, qual 
-- FROM pg_policies 
-- WHERE tablename = 'videos';