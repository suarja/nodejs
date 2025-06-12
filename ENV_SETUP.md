# Environment Setup Guide

This guide explains how to set up the required environment variables for the video generation backend server.

## Required Environment Variables

### Server Configuration

```
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

### Clerk Authentication (NEW)

```
CLERK_SECRET_KEY=your_clerk_secret_key_here
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key_here
```

**How to get Clerk keys:**

1. Go to [Clerk Dashboard](https://dashboard.clerk.com/)
2. Select your application
3. Go to "API Keys" section
4. Copy the Secret Key (starts with `sk_`)
5. Copy the Publishable Key (starts with `pk_`)

### Supabase Configuration

```
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### AWS S3 Configuration

```
AWS_REGION=your_aws_region_here
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
S3_BUCKET_NAME=your_s3_bucket_name_here
```

### External APIs

```
CREATOMATE_API_KEY=your_creatomate_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## New Clerk Integration

The backend now uses Clerk for authentication instead of Supabase Auth. This means:

1. **JWT Token Verification**: The backend verifies Clerk JWT tokens sent from the frontend
2. **Database User Lookup**: After verifying the Clerk user, we lookup the corresponding database user using `clerk_user_id`
3. **Unified Authentication**: Both frontend and backend now use Clerk for consistent authentication

### Authentication Flow

1. Frontend sends Clerk JWT token in `Authorization: Bearer <token>` header
2. Backend verifies token with Clerk using `CLERK_SECRET_KEY`
3. Backend gets Clerk user details
4. Backend looks up database user using `clerk_user_id` field
5. Backend uses database user ID for all database operations

### Updated API Endpoints

All API endpoints now use `ClerkAuthService` for authentication:

- `POST /api/s3-upload` - Generate S3 upload URLs
- `POST /api/source-videos` - Save source video metadata
- `GET /api/source-videos` - Get user's source videos
- `PUT /api/source-videos/:videoId` - Update source video metadata
- `POST /api/videos/generate` - Generate videos
- `GET /api/videos/status/:id` - Get video generation status
- `GET /api/videos` - List user's video requests
