# Video Validation Service Tests

## Overview
Unit tests for the video validation service following an 80/20 Pareto strategy - focusing on the critical paths that catch most issues.

## Setup
```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

## Test Structure

### 1. Template Validation Tests
- Structure validation (dimensions, required properties)
- Template fixes (audio text→source, video fit)
- Error handling for invalid templates

### 2. Voice ID Validation Tests  
- Mismatch detection and auto-correction
- Missing provider handling
- Multi-scene consistency

### 3. Scene Duration Validation Tests
- Word count to duration calculation (0.7 multiplier)
- Safety margin validation (95%)
- Trim vs full duration handling

### 4. Caption Configuration Tests
- Enable/disable captions
- Preset application
- Property conversion

## Test Data
- `/fixtures/videos.json` - Sample video data
- `../../__tests__/templates/` - Real template examples

## Key Testing Patterns

```typescript
// Testing private methods
const violations = (service as any).validateSceneDurations(scenePlan, videos);

// Template structure for tests
const template = {
  output_format: 'mp4',
  width: 1080,
  height: 1920,
  elements: [/* scenes */]
};
```

## Coverage Goals
- 80% coverage for critical validation paths
- Focus on edge cases that cause production issues
- Validate all auto-fix behaviors work correctly