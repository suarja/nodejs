# Testing Clerk Frontend Authentication Integration

## Overview

This guide helps test the integration between the frontend (VideoUploader component) and backend Clerk authentication.

## What Was Fixed

### 1. VideoUploader Component Changes

- **Removed**: Supabase authentication (`supabase.auth.getSession()`)
- **Added**: Clerk authentication (`useAuth().getToken()`)
- **Added**: User sign-in status check before upload
- **Added**: Better error handling with Clerk token

### 2. API Configuration Changes

- **Added**: `CLERK_AUTH()` function to API_HEADERS
- **Purpose**: Provides proper headers for Clerk JWT authentication

## Testing Steps

### Prerequisites

1. Backend server running on `http://localhost:3000`
2. Frontend app running with Clerk authentication enabled
3. User must be signed in with Clerk

### Test 1: Authentication Check

**Expected Behavior**: If user is not signed in, show authentication alert

1. Make sure user is signed out
2. Navigate to source videos screen
3. Try to upload a video
4. **Expected**: Alert saying "Authentication Required - Please sign in to upload videos"

### Test 2: Successful Upload Flow

**Expected Behavior**: Authenticated user can upload videos

1. Sign in with valid Clerk credentials
2. Navigate to source videos screen
3. Click "Sélectionner une vidéo" button
4. Select a video from gallery
5. **Expected**: Video uploads successfully to S3

### Test 3: Backend Authentication

**Expected Behavior**: Backend receives and validates Clerk JWT

1. Check backend logs during upload
2. **Expected Log Patterns**:
   ```
   🔍 Fetching auth token...
   🔑 Got Clerk token, making request to backend...
   ✅ ClerkAuthService: Token verified successfully
   📤 S3 presigned URL generated for user: [clerk_user_id]
   ```

### Test 4: Database Integration

**Expected Behavior**: Video metadata saved with correct user association

1. After successful upload, check database
2. **Expected**: New video record with `user_id` matching database user ID (not Clerk ID)

## Debugging Tips

### Frontend Console Logs

Look for these patterns in React Native/Expo dev tools:

```
🔑 Got Clerk token, making request to backend...
Got presigned URL: { presignedUrl: "...", publicUrl: "...", s3FileName: "..." }
Upload successful! Public URL: ...
```

### Backend Console Logs

Look for these patterns in server terminal:

```
🔍 Fetching auth token...
✅ ClerkAuthService: Token verified successfully
📤 S3 presigned URL generated for user: [clerk_user_id]
```

### Common Issues & Solutions

#### 1. "Authentication Required" Alert

- **Cause**: User not signed in or Clerk not initialized
- **Solution**: Ensure user is signed in and Clerk provider is working

#### 2. "Unable to get authentication token"

- **Cause**: Clerk getToken() returning null/undefined
- **Solution**: Check Clerk session status and user authentication

#### 3. Backend 401 Error

- **Cause**: Invalid or expired Clerk JWT
- **Solution**: Check if frontend is sending proper Clerk token

#### 4. Token Format Issues

- **Cause**: Malformed JWT being sent to backend
- **Solution**: Verify frontend is using `useAuth().getToken()` correctly

## Expected Flow Diagram

```
1. User clicks upload button
   ↓
2. Check if user is signed in (useAuth().isSignedIn)
   ↓
3. Get Clerk JWT token (useAuth().getToken())
   ↓
4. Send token to backend with CLERK_AUTH headers
   ↓
5. Backend verifies token with Clerk
   ↓
6. Backend returns S3 presigned URL
   ↓
7. Frontend uploads directly to S3
   ↓
8. Success callback saves metadata to database
```

## Success Criteria

✅ **Authentication**: User must be signed in to upload
✅ **Token Generation**: Frontend gets valid Clerk JWT token  
✅ **Backend Verification**: Backend successfully verifies Clerk token
✅ **S3 Upload**: Video uploads to user-specific S3 path
✅ **Database Storage**: Video metadata saved with correct user association
✅ **Error Handling**: Proper error messages for auth failures

## Next Steps After Testing

1. Verify source videos list shows uploaded videos
2. Test video metadata editing
3. Ensure video playback works correctly
4. Test user-specific video access (users can only see their own videos)
