# FFmpeg Installation Guide

This guide explains how to install FFmpeg for video conversion capabilities in the video analysis system.

## Why FFmpeg?

FFmpeg is required to convert videos to MP4 format for optimal compatibility with Gemini's Files API. The system automatically detects video formats and converts them to MP4 when needed.

## Supported Video Formats

### Direct Processing (No Conversion Needed)

- MP4 (all variants)

### Conversion Required

- WebM → MP4
- AVI → MP4
- QuickTime/MOV → MP4
- WMV → MP4
- FLV → MP4
- 3GPP → MP4

## Installation Instructions

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install ffmpeg
```

### CentOS/RHEL/Fedora

```bash
# CentOS/RHEL 8+
sudo dnf install ffmpeg

# CentOS/RHEL 7
sudo yum install epel-release
sudo yum install ffmpeg

# Fedora
sudo dnf install ffmpeg
```

### macOS

```bash
# Using Homebrew (recommended)
brew install ffmpeg

# Using MacPorts
sudo port install ffmpeg
```

### Windows

1. Download FFmpeg from https://ffmpeg.org/download.html
2. Extract to `C:\ffmpeg`
3. Add `C:\ffmpeg\bin` to your PATH environment variable
4. Restart your terminal/command prompt

### Docker

If running in Docker, add to your Dockerfile:

```dockerfile
RUN apt-get update && apt-get install -y ffmpeg
```

## Verification

Test FFmpeg installation:

```bash
ffmpeg -version
```

You should see output showing FFmpeg version and configuration.

## Performance Optimization

The system uses these FFmpeg settings for optimal performance:

- Video codec: H.264 (libx264)
- Audio codec: AAC
- Preset: fast (good balance of speed vs quality)
- CRF: 23 (good quality)
- Web optimization: enabled (+faststart)

## Troubleshooting

### FFmpeg Not Found

- Ensure FFmpeg is installed and in your PATH
- Restart your application after installation
- Check permissions if running in containers

### Conversion Failures

- Verify input video is not corrupted
- Check available disk space for temporary files
- Ensure input video format is supported

### Performance Issues

- Large videos take longer to convert
- Consider reducing video quality/resolution before upload
- Monitor CPU usage during conversion

## Alternative Solutions

If FFmpeg installation is not possible:

1. Pre-convert videos to MP4 before upload
2. Use online conversion tools
3. Use video editing software to export as MP4

## Technical Details

### Conversion Process

1. Download video from S3/URL
2. Detect video format using file signatures
3. Convert to MP4 if needed using FFmpeg
4. Upload converted file to Gemini Files API
5. Clean up temporary files

### File Signatures Detected

- MP4: `66747970` (ftyp header)
- WebM: `1a45dfa3` (EBML header)
- AVI: `52494646` (RIFF header)
- QuickTime: `00000014`, `00000018`, `0000001c`
- And more...

## Support

If you encounter issues with FFmpeg installation or video conversion, check the application logs for detailed error messages. The system will provide specific installation instructions when FFmpeg is not found.
