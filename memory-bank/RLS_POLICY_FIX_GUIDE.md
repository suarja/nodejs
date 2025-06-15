# RLS Policy Fix for Clerk Authentication - CRITICAL

## Problem Identified ✅

The UUID error `"invalid input syntax for type uuid: user_2yPKgwigvDuuv91Z9rm2Nb2YdaQ"` is caused by **Row Level Security (RLS) policies** in Supabase that are still using the old authentication pattern.

### Root Cause

- **RLS policies use**: `auth.uid()` which returns the Clerk user ID (e.g., `user_2yPKgwigvDuuv91Z9rm2Nb2YdaQ`)
- **Database tables expect**: Database user UUIDs (e.g., `f3d0be35-d766-4a4a-92bc-ae72614b9470`)
- **Result**: PostgreSQL tries to compare a string to a UUID field and fails

## Solution Overview

We need to:

1. **Add `clerk_user_id` field** to the users table
2. **Create a helper function** to look up database user ID from Clerk user ID
3. **Update all RLS policies** to use the helper function
4. **Populate the `clerk_user_id` field** for existing users

## Step 1: Apply Database Migration (CORRECTED)

⚠️ **If you encountered the dependency error, use this corrected version:**

Run this SQL in your Supabase dashboard (SQL Editor):

```sql
-- Fix RLS policies for Clerk authentication - CORRECTED VERSION
-- This version properly handles function dependencies

-- Step 1: Add clerk_user_id field to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users'
        AND column_name = 'clerk_user_id'
    ) THEN
        ALTER TABLE public.users ADD COLUMN clerk_user_id text UNIQUE;
        CREATE INDEX IF NOT EXISTS users_clerk_user_id_idx ON public.users (clerk_user_id);
    END IF;
END $$;

-- Step 2: Create helper function to get database user ID from Clerk user ID
CREATE OR REPLACE FUNCTION get_database_user_id() RETURNS UUID AS $$
DECLARE
    db_user_id UUID;
BEGIN
    -- Look up database user ID using the Clerk user ID from auth.uid()
    SELECT id INTO db_user_id
    FROM public.users
    WHERE clerk_user_id = auth.uid();

    RETURN db_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION get_database_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_user_id TO anon;

-- Step 3: Drop existing problematic policies (including dependent ones)
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;
DROP POLICY IF EXISTS "Users can CRUD own editorial profiles" ON public.editorial_profiles;
DROP POLICY IF EXISTS "Users can CRUD own voice clones" ON public.voice_clones;
DROP POLICY IF EXISTS "Users can CRUD own videos" ON public.videos;
DROP POLICY IF EXISTS "Users can CRUD own scripts" ON public.scripts;
DROP POLICY IF EXISTS "Users can CRUD own video requests" ON public.video_requests;
DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
DROP POLICY IF EXISTS "Users can read own logs" ON public.logs;

-- Drop user_roles policies that depend on is_admin function
DROP POLICY IF EXISTS admin_user_roles_policy ON user_roles;
DROP POLICY IF EXISTS admin_user_usage_policy ON user_usage;
DROP POLICY IF EXISTS user_roles_select_policy ON user_roles;
DROP POLICY IF EXISTS insert_user_roles_policy ON user_roles;

-- Step 4: Now we can safely drop the old is_admin function
DROP FUNCTION IF EXISTS is_admin(uuid) CASCADE;

-- Step 5: Create new Clerk-compatible policies

-- Users policies - can access own data using database user ID
CREATE POLICY "Users can read own data" ON public.users
  FOR SELECT USING (id = get_database_user_id());

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (id = get_database_user_id());

-- Editorial profiles policies
CREATE POLICY "Users can CRUD own editorial profiles" ON public.editorial_profiles
  FOR ALL USING (user_id = get_database_user_id());

-- Voice clones policies
CREATE POLICY "Users can CRUD own voice clones" ON public.voice_clones
  FOR ALL USING (user_id = get_database_user_id());

-- Videos policies
CREATE POLICY "Users can CRUD own videos" ON public.videos
  FOR ALL USING (user_id = get_database_user_id());

-- Scripts policies
CREATE POLICY "Users can CRUD own scripts" ON public.scripts
  FOR ALL USING (user_id = get_database_user_id());

-- Video requests policies - this is the main one causing the UUID error
CREATE POLICY "Users can CRUD own video requests" ON public.video_requests
  FOR ALL USING (user_id = get_database_user_id());

-- Payments policies
CREATE POLICY "Users can read own payments" ON public.payments
  FOR SELECT USING (user_id = get_database_user_id());

-- Logs policies
CREATE POLICY "Users can read own logs" ON public.logs
  FOR SELECT USING (user_id = get_database_user_id());

-- Step 6: Create new admin function (without parameters)
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
DECLARE
    db_user_id UUID;
BEGIN
    -- Get database user ID from Clerk user ID
    db_user_id := get_database_user_id();

    IF db_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check if user is admin using database user ID
    RETURN EXISTS (
        SELECT 1
        FROM user_roles
        WHERE user_id = db_user_id
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions for the new admin function
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO anon;

-- Step 7: Recreate user_roles policies with new admin function
CREATE POLICY admin_user_roles_policy ON user_roles
  USING (is_admin() OR user_id = get_database_user_id());

CREATE POLICY user_roles_select_policy ON user_roles
  FOR SELECT USING (user_id = get_database_user_id());

CREATE POLICY insert_user_roles_policy ON user_roles
  FOR INSERT WITH CHECK (
    -- Allow users to insert their own non-admin roles
    (user_id = get_database_user_id() AND role <> 'admin')
    OR
    -- Allow admins to insert any roles
    is_admin()
    OR
    -- Allow initial admin creation if no admins exist
    (role = 'admin' AND NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin'))
  );

-- Step 8: Handle user_usage table if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_usage') THEN
        CREATE POLICY admin_user_usage_policy ON user_usage
          USING (is_admin() OR user_id = get_database_user_id());
    END IF;
END $$;
```

## Step 2: Populate clerk_user_id Field

After applying the migration, you need to populate the `clerk_user_id` field for existing users.

**For your current user** (based on the logs):

```sql
UPDATE public.users
SET clerk_user_id = 'user_2yPKgwigvDuuv91Z9rm2Nb2YdaQ'
WHERE id = 'f3d0be35-d766-4a4a-92bc-ae72614b9470';
```

**For any other existing users**, you'll need to determine their Clerk user IDs and update accordingly.

## Step 3: Verification

After applying the fix, verify that:

1. **Database query works**:

   ```sql
   SELECT get_database_user_id(); -- Should return your database user UUID
   ```

2. **RLS policies work**:
   ```sql
   SELECT * FROM video_requests; -- Should return your videos without UUID error
   ```

## Expected Results

After applying this fix:

- ✅ **UUID error resolved**: No more `"invalid input syntax for type uuid"`
- ✅ **Generated videos load**: Video list should display correctly
- ✅ **Video details work**: Individual video pages should load
- ✅ **Security maintained**: Users can only access their own data
- ✅ **Admin functions preserved**: Admin roles still work correctly

## Backend Integration

The backend Clerk authentication remains unchanged - it still:

1. ✅ Verifies Clerk JWT tokens
2. ✅ Looks up database users using `clerk_user_id`
3. ✅ Uses database user IDs for all operations

This fix bridges the gap between Clerk authentication (JWT contains Clerk user ID) and database operations (tables use database user UUIDs).

## Troubleshooting

If issues persist after applying the fix:

1. **Check clerk_user_id field**: Ensure it's populated for your user
2. **Verify function works**: Test `SELECT get_database_user_id();`
3. **Check RLS policies**: Ensure old policies are dropped and new ones are applied
4. **Clear app cache**: Restart the mobile app to clear any cached data

## Common Issues

### Dependency Error (RESOLVED)

If you see:

```
ERROR: cannot drop function is_admin(uuid) because other objects depend on it
```

This is resolved in the corrected migration above by:

1. Dropping dependent policies first
2. Using `DROP ... CASCADE` for the function
3. Recreating everything in the proper order

## Files Updated

- ✅ **Frontend**: `ai-edit/app/(tabs)/videos.tsx` - Restored original query
- ✅ **Migration**: `ai-edit/supabase/migrations/20241220000000_fix_clerk_rls_policies.sql`
- ✅ **Documentation**: This guide for manual application

The core issue was **database-level authentication**, not frontend code. The RLS policies needed to be updated to bridge Clerk user IDs with database user UUIDs.
