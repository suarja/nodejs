# 🧪 Authentication Testing Guide

## Problem Diagnosis

The error indicates that the JWT token is not in the correct format:

```
Invalid JWT form. A JWT consists of three parts separated by dots.
```

## Step 1: Test with Basic curl (No Auth)

```bash
# Test health endpoint (should work)
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "success": true,
  "message": "API is healthy",
  "timestamp": "2025-01-27T..."
}
```

## Step 2: Test Auth Debug Endpoint

```bash
# Test auth endpoint without token (should fail gracefully)
curl http://localhost:3000/api/auth-test
```

Expected response:

```json
{
  "success": false,
  "error": "No Authorization header provided",
  "hint": "Include Authorization: Bearer <clerk-jwt-token> in your request"
}
```

## Step 3: Frontend Token Debugging

The issue is likely that the frontend is sending the wrong token format. Check:

### A. Frontend should use Clerk token, not Supabase token

Make sure the frontend code is using:

```typescript
// ✅ CORRECT - Clerk token
const { getToken } = useAuth(); // from @clerk/clerk-expo
const token = await getToken();

// ❌ WRONG - Supabase token
const {
  data: { session },
} = await supabase.auth.getSession();
const token = session?.access_token;
```

### B. Check token format in frontend

Add this debugging to your frontend upload function:

```typescript
const token = await getToken();
console.log("🔍 Token length:", token?.length);
console.log("🔍 Token parts:", token?.split(".").length);
console.log("🔍 Token preview:", token?.substring(0, 50) + "...");
```

A valid JWT should:

- Be ~800-2000 characters long
- Have exactly 3 parts when split by dots
- Start with `eyJ` (base64 encoded JSON)

## Step 4: Test with Frontend Token

Once you get a token from the frontend, test it manually:

```bash
# Replace YOUR_TOKEN_HERE with actual token from frontend
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:3000/api/auth-test
```

Expected success response:

```json
{
  "success": true,
  "message": "Authentication successful!",
  "data": {
    "clerkUser": {
      "id": "user_...",
      "email": "user@example.com"
    },
    "databaseUser": {
      "id": "uuid...",
      "email": "user@example.com",
      "full_name": "User Name"
    }
  }
}
```

## Common Issues & Solutions

### Issue 1: Token is undefined/null

**Cause**: Frontend not authenticated or token not retrieved correctly
**Solution**: Ensure user is signed in and `getToken()` returns a value

### Issue 2: Token has wrong format (not 3 parts)

**Cause**: Sending Supabase token instead of Clerk token
**Solution**: Use Clerk's `getToken()` instead of Supabase session token

### Issue 3: Token verification fails

**Cause**: Wrong `CLERK_SECRET_KEY` or token from different Clerk app
**Solution**: Verify environment variables match Clerk dashboard

### Issue 4: Database user not found

**Cause**: User exists in Clerk but not in database with `clerk_user_id`
**Solution**: Complete onboarding process to create database record

## Environment Variables Check

Ensure these are set in server `.env`:

```env
CLERK_SECRET_KEY=sk_test_...     # Must match your Clerk app
CLERK_PUBLISHABLE_KEY=pk_test_... # Must match your Clerk app
```

## Next Steps

1. **Check frontend token source** - Make sure it's from Clerk, not Supabase
2. **Verify token format** - Should be JWT with 3 parts
3. **Test manually** - Use curl with the frontend token
4. **Check environment** - Verify Clerk keys are correct

The detailed logs in the server console will help identify exactly where the issue occurs.
