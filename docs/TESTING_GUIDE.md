# Testing Guide: Server-Primary API

This document outlines the comprehensive testing strategy for the `server-primary` service, with a focus on the video generation pipeline and core API functionality.

## Testing Philosophy

We follow an **80/20 Pareto testing strategy** - investing 80% of our testing effort in the 20% of code that handles the most critical functionality and is most likely to cause production issues.

### Testing Approach

1. **Unit Tests** (Priority 1): Fast, isolated tests for core business logic
2. **Integration Tests** (Priority 2): Component interaction validation
3. **End-to-End Tests** (Priority 3): Full workflow validation against live services

---

## Test Framework: Vitest

We've migrated from Jest to **Vitest** for better performance and modern tooling.

### Key Benefits
- ⚡ **Faster execution** - Tests run in ~5ms
- 🔧 **Better TypeScript support** - Native ESM support
- 🧪 **Modern testing features** - Built-in coverage, UI, and watch mode
- 📊 **Coverage reporting** - V8 coverage provider

---

## Current Test Suites

### 1. Video Validation Service ✅ **[IMPLEMENTED]**

- **File**: `src/services/video/__tests__/validation-service.test.ts`
- **Coverage**: 21 comprehensive test cases
- **Purpose**: Validate the most critical part of video generation pipeline

#### Test Categories:

**Template Validation (6 tests)**
- Structure validation (dimensions, required properties)
- Template fixes (audio text→source, video fit=cover)
- Error handling for malformed templates

**Voice ID Validation (6 tests)**
- Auto-correction of mismatched voice IDs
- Missing provider string handling
- Multi-scene consistency validation

**Scene Duration Validation (9 tests)**
- Word-to-duration calculations (0.7 multiplier)
- Safety margin validation (95% rule)
- Trim vs full duration logic

---

## Testing Roadmap

### 🚨 **CRITICAL ISSUE DISCOVERED**
**Main video generation feature is completely broken** - the mobile app has the entire API call commented out in `useVideoRequest.ts:326-342`. This must be fixed before comprehensive testing.

### Phase 1: Core Validation ✅ **[COMPLETED]**
- [x] Video Validation Service (21 tests passing)
- [x] Voice ID validation and auto-fixing
- [x] Template structure validation
- [x] Scene duration calculations

### Phase 2: Critical Path Testing **[URGENT - HIGHEST PRIORITY]**

Based on API audit findings, focus on endpoints that are actually used:

#### 2.1 Video Generation Pipeline 🚨 **[BROKEN - FIX FIRST]**
- **Endpoints**: `POST /api/scripts/generate-video/:id` (commented out in mobile)
- **Services**: `VideoTemplateService`, `VideoValidationService`, `CreatomateBuilder`
- **Priority**: **CRITICAL** (main feature is non-functional)
- **Tests needed**:
  - [ ] Full script-to-video generation flow
  - [ ] Error handling when mobile API call is restored
  - [ ] Template validation integration
  - [ ] Background processing reliability

#### 2.2 Script Management **[HIGH PRIORITY]**
- **Endpoints**: 6 active endpoints (GET, POST, DELETE /api/scripts/*)
- **Files**: `src/routes/api/scripts.ts`
- **Priority**: HIGH (core user interaction)
- **Tests needed**:
  - [ ] Script CRUD operations
  - [ ] AI chat functionality (`scriptChatHandler`)
  - [ ] Script modification (`modifyCurrentScriptHandler`)
  - [ ] Integration with video generation

#### 2.3 Voice Cloning System **[HIGH PRIORITY]**
- **Endpoints**: 3 active endpoints (/api/voice-clone, /api/onboarding)
- **Files**: `src/routes/api/voiceClone.ts`, `src/routes/api/onboarding.ts`
- **Priority**: HIGH (key differentiator)
- **Tests needed**:
  - [ ] Voice sample upload and processing
  - [ ] Voice library management
  - [ ] Integration with video generation
  - [ ] Voice ID validation (already tested in ValidationService)

### Phase 3: Supporting Features **[MEDIUM PRIORITY]**

#### 3.1 Source Video Management
- **Endpoints**: 4 active endpoints (/api/s3-upload, /api/source-videos)
- **Files**: `src/routes/api/s3Upload.ts`, `src/routes/api/sourceVideos.ts`
- **Priority**: MEDIUM (supporting video generation)
- **Tests needed**:
  - [ ] S3 upload functionality
  - [ ] Video metadata CRUD operations
  - [ ] Integration with video generation pipeline

#### 3.2 Video Status & Management
- **Endpoints**: 2 active endpoints (/api/videos/status, DELETE /api/videos)
- **Files**: `src/routes/api/videos.ts`, `src/routes/api/videoDelete.ts`
- **Priority**: MEDIUM (user experience)
- **Tests needed**:
  - [ ] Video status polling
  - [ ] Video deletion workflow
  - [ ] Status update mechanisms

### Phase 4: External Integrations **[LOWER PRIORITY]**

#### 4.1 Support & User Management
- **Endpoints**: 2 active endpoints (/api/support, /api/user-management)
- **Files**: `src/routes/api/support.ts`, `src/routes/api/userManagement.ts`
- **Priority**: LOW (administrative features)
- **Tests needed**:
  - [ ] Issue reporting functionality
  - [ ] User account deletion
  - [ ] Data cleanup processes

#### 4.2 Legacy & Deprecated Endpoints
- **Status**: 10 deprecated endpoints identified
- **Priority**: CLEANUP (remove unused code)
- **Actions needed**:
  - [ ] Remove deprecated prompt enhancement endpoints
  - [ ] Clean up legacy video generation code
  - [ ] Remove unused webhook endpoints

---

## How to Run Tests

### Available Commands

```bash
# Quick single run with clean output
npm run test:run

# Watch mode for development
npm test

# Interactive UI for debugging
npm run test:ui

# Coverage report (requires @vitest/coverage-v8)
npm run test:coverage

# Legacy Jest tests (gradually migrating)
npm run test:jest
```

### Test Organization

```
server-primary/
├── src/services/video/
│   └── __tests__/
│       ├── validation-service.test.ts    ✅ 21 tests
│       ├── template-service.test.ts      🚧 TODO
│       ├── generator.test.ts             🚧 TODO
│       └── fixtures/
│           ├── videos.json
│           └── templates/
├── tests/                                📁 Integration tests
│   └── services/
│       ├── creatomateBuilder.test.ts     📝 Existing (Jest)
│       └── creatomateBuilder.e2e.test.ts 📝 Existing (Jest)
└── vitest.config.ts                      ⚙️ Configuration
```

---

## Testing Best Practices

### 1. **Mock Strategy**
- Mock external dependencies (OpenAI, Supabase, AWS)
- Use real data structures for business logic tests
- Mock at service boundaries, not implementation details

### 2. **Test Data**
- Use realistic fixtures from `fixtures/` directory
- Test with actual template structures from Creatomate
- Include edge cases and error scenarios

### 3. **Assertions**
- Focus on business logic outcomes, not implementation
- Test error messages and edge cases
- Validate data transformations thoroughly

### 4. **Performance**
- Unit tests should run in <10ms
- Integration tests should run in <100ms
- Use `vi.mock()` to avoid expensive operations

---

## Success Metrics

### Current Status
- ✅ **21/21 tests passing** for validation service
- ⚡ **~5ms execution time** for full test suite
- 📊 **High coverage** of critical validation paths

### Target Goals
- 🎯 **80% code coverage** for critical business logic
- 🚀 **<50ms** total test execution time
- 🔧 **Zero false positives** in validation logic
- 📈 **100% test pass rate** in CI/CD pipeline

---

## Migration Status

### Completed Migrations
- [x] Video Validation Service (Jest → Vitest)
- [x] Test infrastructure setup
- [x] CI/CD integration

### Pending Migrations
- [ ] CreatomateBuilder tests (Jest → Vitest)
- [ ] Integration test suite
- [ ] Performance test harness

---

## Contributing to Tests

### Adding New Tests
1. Create test file in appropriate `__tests__/` directory
2. Follow existing naming convention: `service-name.test.ts`
3. Use realistic fixtures from `fixtures/` directory
4. Include both happy path and error scenarios

### Test Template
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceUnderTest } from '../service-under-test';

// Mock dependencies
vi.mock('../dependency', () => ({
  dependency: vi.fn(),
}));

describe('ServiceUnderTest', () => {
  let service: ServiceUnderTest;
  
  beforeEach(() => {
    service = new ServiceUnderTest();
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = {};
      
      // Act
      const result = service.methodName(input);
      
      // Assert
      expect(result).toBeDefined();
    });

    it('should handle error case', () => {
      // Test error scenarios
    });
  });
});
```

## Complete Data Flow Overview

### Mobile App → Server-Primary API Flow

Based on comprehensive API audit, here's the actual data flow:

#### **1. User Authentication Flow**
```
Mobile App → Clerk Authentication → Server-Primary API
- All endpoints require Clerk JWT token
- Authentication handled by editia-core middleware
```

#### **2. Script Management Flow (Working)**
```
Mobile: Script Chat UI → useScriptChat hook
↓
API: POST /api/scripts/chat → scriptChatHandler
↓
Database: script_drafts table updates
↓
Mobile: Real-time script updates
```

#### **3. Video Generation Flow (BROKEN)**
```
Mobile: Script Video Settings → useVideoRequest hook
↓
🚨 BROKEN: API call commented out (lines 326-342)
↓
Should be: POST /api/scripts/generate-video/:id
↓
Backend: generateVideoFromScriptHandler → VideoTemplateService
↓
ValidationService (3 phases) → CreatomateBuilder → Creatomate API
```

#### **4. Voice Cloning Flow (Working)**
```
Mobile: Voice Recording → voiceRecordingService
↓
API: POST /api/voice-clone → voiceCloneRouter
↓
ElevenLabs API integration
↓
Database: voice samples stored
```

#### **5. Source Video Management Flow (Working)**
```
Mobile: Video Upload → useSourceVideos hook
↓
API: POST /api/s3-upload → uploadS3Handler
↓
AWS S3 storage
↓
Database: videos table metadata
```

### Server-Primary Internal Flow

#### **Video Template Generation (When Working)**
```
generateVideoFromScriptHandler
↓
VideoTemplateService.generateTemplate()
├── Phase 1: validateInputConfiguration()
├── Phase 2: CreatomateBuilder.planVideoStructure()
├── Phase 3: validateAndRepairScenePlan()
├── Phase 4: CreatomateBuilder.generateTemplate()
├── Phase 5: Template fixes (audio, video, captions)
└── Phase 6: validateTemplate() (final validation)
↓
Creatomate API render request
↓
Database: video_requests table updated
```

## API Audit Results Summary

### **Active Endpoints (18 total)**
- ✅ Script Management: 6 endpoints
- ✅ Voice Cloning: 3 endpoints  
- ✅ Source Videos: 4 endpoints
- ✅ Video Management: 2 endpoints
- ✅ User Support: 2 endpoints
- 🚨 Video Generation: 1 endpoint (broken in mobile)

### **Deprecated/Unused (10 total)**
- Legacy prompt enhancement (3 endpoints)
- Legacy video generation (1 endpoint)
- Unused webhook (1 endpoint)
- Unused analysis (1 endpoint)
- Legacy Supabase functions (2 endpoints)
- Duplicate TikTok endpoints (2 endpoints)

### **Critical Issues**
1. **Main feature completely broken** - Video generation API call commented out
2. **URL path error** - TikTok active job endpoint missing /api prefix

This testing strategy ensures we maintain high code quality while focusing our efforts on the critical parts that actually work and are used by the mobile application.