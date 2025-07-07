# Railway Deployment Guide with FFmpeg

This guide explains how to deploy the video analysis service to Railway with FFmpeg support.

## 🚂 Railway + FFmpeg Setup

Based on [Railway FFmpeg Forum Discussion](https://railway.app/help/fix-ffmpeg-issues), we use system FFmpeg instead of npm packages.

### 1. Configuration Files

**Create `nixpacks.toml` in project root:**

```toml
# Railway deployment configuration with FFmpeg support
[phases.setup]
nixPkgs = ['ffmpeg']

[phases.build]
cmds = [
    'npm ci',
    'npm run build'
]

[start]
cmd = 'npm start'

[env]
NODE_ENV = 'production'
RAILWAY_ENVIRONMENT = 'production'
```

**⚠️ Important Notes:**

- Do NOT include `npm` in nixPkgs - it comes automatically with Node.js
- Do NOT include `nodejs_18` in nixPkgs - Railway installs Node.js automatically
- Only include `ffmpeg` in nixPkgs

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

1. **Push code with correct nixpacks.toml**
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

Remove `npm` and `nodejs_18` from nixPkgs in nixpacks.toml:

```toml
# ❌ Wrong
nixPkgs = ['ffmpeg', 'nodejs_18', 'npm']

# ✅ Correct
nixPkgs = ['ffmpeg']
```

### FFmpeg Not Found in Production

**Error:**

```
❌ FFmpeg path detection failed
```

**Solution:**

1. Verify nixpacks.toml is in project root
2. Check Railway build logs for FFmpeg installation
3. Ensure nixPkgs syntax is correct

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

2. **Update nixpacks.toml:**

```toml
[phases.setup]
nixPkgs = ['ffmpeg']
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

- Ensure `nixpacks.toml` includes `ffmpeg` in nixPkgs
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

| Environment       | FFmpeg Source   | Path Detection | Temp Directory |
| ----------------- | --------------- | -------------- | -------------- |
| **Railway**       | nixpkgs         | `which ffmpeg` | `/tmp`         |
| **Local Mac**     | System/Homebrew | `which ffmpeg` | `./temp`       |
| **Local Linux**   | System/apt      | `which ffmpeg` | `./temp`       |
| **Local Windows** | npm package     | import path    | `./temp`       |

## 📊 Deployment Process

### 1. Railway Project Setup

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway init
```

### 2. Deploy to Railway

```bash
# Deploy current branch
railway up

# Or connect GitHub repository
# Set up GitHub integration in Railway dashboard
```

### 3. Monitor Deployment

```bash
# View logs
railway logs

# View environment
railway variables
```

### 4. Test Video Analysis

```bash
# Use our test script
npm run test:video-analysis
```

## 🎯 Performance Optimization

### Railway-Specific Optimizations

1. **Memory Usage:**

   - Railway provides 1GB RAM by default
   - Large videos may require more memory
   - Consider upgrading plan for heavy usage

2. **Disk Space:**

   - Ephemeral storage for temp files
   - Clean up files immediately after processing
   - No persistent storage needed for temp files

3. **Processing Time:**
   - Railway has request timeouts
   - Large videos may need async processing
   - Consider background job queues for long videos

### FFmpeg Settings for Railway

```typescript
// Optimized FFmpeg args for Railway
const ffmpegArgs = [
  "-i",
  inputPath,
  "-c:v",
  "libx264",
  "-c:a",
  "aac",
  "-preset",
  "fast", // Faster encoding
  "-crf",
  "28", // Slightly lower quality for speed
  "-movflags",
  "+faststart",
  "-threads",
  "2", // Limit threads for Railway
  "-y",
  outputPath,
];
```

## 🔍 Debugging

### Enable Debug Logs

```typescript
// Add to your Railway environment variables
(DEBUG = ffmpeg), gemini, video - analysis;
```

### Check FFmpeg Installation

```bash
# SSH into Railway container (when available)
which ffmpeg
ffmpeg -version
ls -la /nix/store/*/bin/ffmpeg
```

### Test FFmpeg Manually

```bash
# Test basic FFmpeg functionality
ffmpeg -f lavfi -i testsrc=duration=1:size=320x240:rate=1 test.mp4
```

## 📈 Monitoring

### Key Metrics to Monitor

1. **Response Times:**

   - Video download time
   - FFmpeg conversion time
   - Gemini analysis time
   - Total request time

2. **Error Rates:**

   - FFmpeg failures
   - Gemini API errors
   - Network timeouts

3. **Resource Usage:**
   - Memory consumption
   - CPU usage during conversion
   - Disk space for temp files

### Railway Logging

```typescript
// Structured logging for Railway
console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    message: "Video analysis started",
    videoUrl: url,
    environment: "railway",
  })
);
```

## 🚀 Production Checklist

- [ ] `nixpacks.toml` configured with FFmpeg
- [ ] Environment variables set in Railway
- [ ] Code uses system FFmpeg detection
- [ ] Temp file cleanup implemented
- [ ] Error handling for Railway-specific issues
- [ ] Monitoring and logging configured
- [ ] Performance optimized for Railway limits
- [ ] Test deployment works with sample video

## 🆘 Support

If you encounter issues:

1. Check Railway logs: `railway logs`
2. Verify FFmpeg installation in container
3. Test with smaller video files first
4. Reference [Railway FFmpeg Forum](https://railway.app/help/fix-ffmpeg-issues)
5. Check our test script output

## 📚 References

- [Railway FFmpeg Issue Discussion](https://railway.app/help/fix-ffmpeg-issues)
- [Nixpacks Configuration](https://nixpacks.com/docs/configuration)
- [Railway Environment Variables](https://docs.railway.app/deploy/variables)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
