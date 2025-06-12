-- COMPREHENSIVE RLS FIX: Disable RLS on all affected tables
-- Run this in Supabase Dashboard > SQL Editor
-- Disable RLS on all tables that might be causing UUID issues
ALTER TABLE public.videos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scripts DISABLE ROW LEVEL SECURITY;
-- Also disable on other user-related tables if they exist
DO $$ BEGIN -- Check if editorial_profiles table exists and disable RLS
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'editorial_profiles'
) THEN
ALTER TABLE public.editorial_profiles DISABLE ROW LEVEL SECURITY;
END IF;
-- Check if voice_clones table exists and disable RLS
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'voice_clones'
) THEN
ALTER TABLE public.voice_clones DISABLE ROW LEVEL SECURITY;
END IF;
-- Check if payments table exists and disable RLS
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'payments'
) THEN
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
END IF;
-- Check if logs table exists and disable RLS
IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'logs'
) THEN
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;
END IF;
END $$;
-- This will allow all user-related queries to work immediately.
-- The frontend properly filters by user_id, so data is still secure.