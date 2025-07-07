# Railway Deployment Guide with FFmpeg

This guide explains how to deploy the video analysis service to Railway with FFmpeg support.

## 🚂 Railway + FFmpeg Setup

Due to nixpacks cache mount conflicts, we use a **custom Dockerfile** instead of nixpacks.toml.

### 1. Configuration Files

**Create `Dockerfile` in project root:**

```dockerfile
# Custom Dockerfile for Railway deployment with FFmpeg
FROM node:22-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no cache to avoid conflicts)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (Railway will override this)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

**⚠️ Important Notes:**

- Do NOT use nixpacks.toml - it causes EBUSY cache conflicts
- Use custom Dockerfile with Alpine Linux for smaller image
- Node.js 22 LTS and FFmpeg installed via apk
- No cache mounts to avoid Railway conflicts

### 2. Environment Variables

Set these in Railway dashboard:

```env
NODE_ENV=production
RAILWAY_ENVIRONMENT=production
GOOGLE_API_KEY=your_gemini_api_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_REGION=us-east-1
CLERK_SECRET_KEY=your_clerk_key
DATABASE_URL=your_supabase_url
```

### 3. Code Changes Required

Remove any npm FFmpeg packages from package.json:

```bash
npm uninstall @ffmpeg-installer/ffmpeg ffprobe-static
```

Our `GeminiService` automatically detects Railway environment and uses system FFmpeg:

- Local: Uses system FFmpeg or falls back to npm packages
- Railway: Uses system FFmpeg installed via nixpkgs

### 4. FFmpeg Path Detection

The service automatically detects FFmpeg path:

```typescript
// Railway/Linux: Uses system FFmpeg
const ffmpegPath = execSync("which ffmpeg", { encoding: "utf8" }).trim();
```

### 5. Deployment Steps

1. **Push code with correct Dockerfile**
2. **Set environment variables in Railway dashboard**
3. **Deploy and check logs**

Expected Railway logs:

```
✅ Found system FFmpeg: /nix/store/.../bin/ffmpeg
🚀 Initializing Gemini Service (Environment: production)
```

## 🐛 Troubleshooting

### Build Error: "undefined variable 'npm'"

**Error:**

```
error: undefined variable 'npm'
at /app/.nixpacks/nixpkgs-ffeebf0acf3ae8b29f8c7049cd911b9636efd7e7.nix:19:26:
```

**Solution:**
Remove only `npm` from nixPkgs in nixpacks.toml (keep nodejs_22):

```toml
# ❌ Wrong
nixPkgs = ['ffmpeg', 'nodejs_22', 'npm']

# ✅ Correct
nixPkgs = ['ffmpeg', 'nodejs_22']
```

### Build Error: "npm: command not found"

**Error:**

```
/bin/bash: line 1: npm: command not found
```

**Solution:**
Add `nodejs_22` back to nixPkgs - Railway doesn't auto-detect Node.js:

```toml
# ❌ Wrong (missing Node.js)
nixPkgs = ['ffmpeg']

# ✅ Correct
nixPkgs = ['ffmpeg', 'nodejs_22']
```

### Build Error: "Unsupported engine" - Node.js version

**Error:**

```
npm warn EBADENGINE Unsupported engine {
npm warn EBADENGINE   package: '@google/genai@1.8.0',
npm warn EBADENGINE   required: { node: '>=20.0.0' },
npm warn EBADENGINE   current: { node: 'v18.20.5', npm: '10.8.2' }
npm warn EBADENGINE }
```

**Solution:**
Update to Node.js 22 in nixpacks.toml:

```toml
# ❌ Wrong (Node.js 18 too old)
nixPkgs = ['ffmpeg', 'nodejs_18']

# ✅ Correct (Node.js 22 required)
nixPkgs = ['ffmpeg', 'nodejs_22']
```

### Build Error: "EBUSY: resource busy or locked"

**Error:**

```
npm error code EBUSY
npm error syscall rmdir
npm error path /app/node_modules/.cache
npm error errno -16
npm error EBUSY: resource busy or locked, rmdir '/app/node_modules/.cache'
```

**Solution:**
This is a Railway cache mount conflict. Fix with these nixpacks.toml changes:

```toml
[phases.build]
cmds = [
    'npm ci --no-cache --prefer-offline',  # Disable npm cache
    'npm run build'
]

# Disable problematic cache mounts
[variables]
NIXPACKS_NO_CACHE = '1'
```

**Alternative solutions:**

1. **Clear Railway cache** in Railway dashboard → Settings → Clear Cache
2. **Redeploy** the service completely
3. **Wait 5-10 minutes** between deploys to let caches clear

The cache flags should prevent this issue permanently.

### FFmpeg Not Found in Production

**Error:**

```
❌ FFmpeg path detection failed
```

**Solution:**

1. Verify Dockerfile is in project root
2. Check Railway build logs for FFmpeg installation
3. Ensure Dockerfile syntax is correct

### Conversion Failures

**Error:**

```
❌ FFmpeg conversion failed
```

**Solutions:**

1. Check available disk space
2. Verify video format is supported
3. Monitor memory usage during conversion

## 🎯 Testing Railway Deployment

### Test FFmpeg Installation

SSH into Railway container (if available) or check logs:

```bash
which ffmpeg
ffmpeg -version
```

### Test Video Analysis

Use our test script:

```bash
npm run test:video
```

Expected output:

```
🧪 Testing Video Analysis Service
📹 Test Video URL: [your-test-url]
🐧 Detecting system FFmpeg (Railway/Linux)...
✅ Found system FFmpeg: /nix/store/.../bin/ffmpeg
```

## 📊 Performance Considerations

### Railway Resource Limits

- **CPU**: FFmpeg conversion is CPU-intensive
- **Memory**: Large videos require more RAM
- **Disk**: Temporary files need space
- **Network**: Video downloads consume bandwidth

### Optimization Tips

1. **File Size Limits**: Implement client-side limits (<100MB)
2. **Timeout Handling**: Set reasonable timeouts for large files
3. **Cleanup**: Ensure temporary files are deleted
4. **Monitoring**: Track conversion times and failures

## 🔄 Migration from npm FFmpeg packages

If you were using `@ffmpeg-installer/ffmpeg`:

1. **Remove npm packages:**

```bash
npm uninstall @ffmpeg-installer/ffmpeg
```

2. **Update Dockerfile:**

```dockerfile
# Custom Dockerfile for Railway deployment with FFmpeg
FROM node:22-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (no cache to avoid conflicts)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port (Railway will override this)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
```

3. **Code already handles both environments automatically**

## ✅ Success Indicators

When deployment works correctly:

1. **Build logs show:**

```
Installing ffmpeg via nixpkgs...
✅ FFmpeg installed successfully
```

2. **Application logs show:**

```
🐧 Detecting system FFmpeg (Railway/Linux)...
✅ Found system FFmpeg: /nix/store/.../bin/ffmpeg
🚀 Initializing Gemini Service (Environment: production)
```

3. **Video analysis works:**

```
📥 Downloaded video: [size] bytes
🎬 Detected format: MP4 (video/mp4)
🔄 Needs conversion: false
📤 Video uploaded to Gemini: [file-id]
✅ Video analysis completed in [time]ms
```

## 🔧 Troubleshooting Railway FFmpeg

### Common Issues & Solutions

#### 1. FFmpeg Not Found

**Problem:** `FFmpeg not found` error in Railway logs

**Solution:**

- Ensure Dockerfile includes FFmpeg installation
- Redeploy after adding configuration
- Check logs for FFmpeg path detection

#### 2. Fast Completion (No Processing)

**Problem:** FFmpeg completes instantly (like 10-100ms) but no output file

**Symptoms from Railway Forum:**

- Exit code: null
- No stderr output
- No output file created

**Solution:**

- Use system FFmpeg via nixpkgs (not npm packages)
- Use `which ffmpeg` to get correct path
- Ensure proper spawn arguments

#### 3. Storage Volume Issues

**Problem:** Files not being written to temp directory

**Solution:**

- Use `/tmp` directory (Railway provides ephemeral storage)
- Ensure directory exists before writing
- Clean up temp files after processing

#### 4. Container Permissions

**Problem:** Permission denied errors

**Solution:**

- Use Railway's default `/tmp` directory
- Don't mount custom storage volumes for temp files
- Ensure proper file permissions

### Environment Differences

| Environment   | FFmpeg Source   | Path Detection | Temp Directory |
| ------------- | --------------- | -------------- | -------------- |
| **Railway**   | nixpkgs         | `which ffmpeg` | `/tmp`         |
| **Local Mac** | System/Homebrew | `              |
