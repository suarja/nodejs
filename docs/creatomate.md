# Creatomate API Documentation

This document provides the structure and requirements for generating video templates using the Creatomate API.

## Template Structure

A Creatomate template is a JSON object that defines the structure of a video. For TikTok-style vertical videos, use the following format:

### Basic Template Structure

```json
{
  "output_format": "mp4",
  "width": 1080,
  "height": 1920,
  "duration": null,
  "elements": [
    // Scene compositions go here
  ]
}
```

### Scene Composition Structure

Each scene is a composition element containing video, audio, and text elements:

```json
{
  "id": "scene-1",
  "type": "composition",
  "track": 1,
  "time": 0,
  "duration": null,
  "elements": [
    // Video element
    {
      "id": "video-1",
      "type": "video",
      "track": 1,
      "source": "video_url_here",
      "time": 0,
      "duration": null,
      "volume": 0,
      "fit": "crop",
      "x_alignment": "50%",
      "y_alignment": "50%"
    },
    // Audio element (AI voice)
    {
      "id": "audio-1",
      "type": "audio",
      "track": 3,
      "time": 0,
      "duration": null,
      "provider": "eleven_labs",
      "voice_id": "voice_id_here",
      "dynamic": true,
      "text": "Script text for this scene"
    },
    // Text element (subtitles)
    {
      "id": "subtitle-1",
      "type": "text",
      "track": 2,
      "time": 0,
      "duration": null,
      "transcript_source": "audio-1",
      "width": "50%",
      "x_alignment": "50%",
      "y_alignment": "85%",
      "font_family": "Open Sans",
      "font_weight": "800",
      "font_size": "8%",
      "color": "#FFFFFF",
      "stroke_color": "#000000",
      "stroke_width": "3%",
      "text_align": "center"
    }
  ]
}
```

## Required Elements

### Video Element

- **type**: "video"
- **track**: 1 (video track)
- **source**: URL of the video asset
- **volume**: 0 (muted to avoid interference with voiceover)
- **fit**: "crop" (to fit vertical format)

### Audio Element

- **type**: "audio"
- **track**: 3 (audio track)
- **provider**: "eleven_labs"
- **voice_id**: ElevenLabs voice ID
- **dynamic**: true (for text-to-speech)
- **text**: Script text for this scene

### Text Element (Subtitles)

- **type**: "text"
- **track**: 2 (subtitle track)
- **transcript_source**: ID of the audio element
- **width**: "50%" (responsive width)
- **x_alignment**: "50%" (centered horizontally)
- **y_alignment**: "85%" (positioned near bottom)

## Timing and Duration

- Use `null` for duration to auto-calculate based on content
- Use `0` for time on first scene, subsequent scenes will auto-calculate
- Scenes will play sequentially based on audio duration

## Best Practices

1. **Video Assets**: Always use provided video URLs exactly as given
2. **Audio Sync**: Link subtitles to audio using `transcript_source`
3. **Vertical Format**: Maintain 1080x1920 dimensions for TikTok
4. **Text Styling**: Use high contrast colors for readability
5. **Scene Planning**: Aim for 3-7 scenes per video for optimal engagement

## Error Prevention

- Ensure all required fields are present
- Use exact video URLs from provided assets
- Link audio and subtitle elements correctly
- Maintain consistent track numbers across scenes
