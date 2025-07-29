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

### Phase 1: Core Validation ✅ **[COMPLETED]**
- [x] Video Validation Service
- [x] Voice ID validation and auto-fixing
- [x] Template structure validation
- [x] Scene duration calculations

### Phase 2: Service Layer **[NEXT - HIGH PRIORITY]**

#### 2.1 Video Template Service
- **File**: `src/services/video/template-service.ts`
- **Priority**: HIGH
- **Tests needed**:
  - [ ] `generateTemplate()` method - Main orchestration flow
  - [ ] Template generation with scene planning
  - [ ] Error handling and retry logic
  - [ ] Configuration validation

#### 2.2 Video Generator Service  
- **File**: `src/services/video/generator.ts`
- **Priority**: HIGH
- **Tests needed**:
  - [ ] `generateVideoFromScript()` - Request handling
  - [ ] Background processing logic
  - [ ] Database state management
  - [ ] Error recovery

#### 2.3 CreatomateBuilder
- **File**: `src/services/creatomateBuilder.ts`
- **Priority**: HIGH
- **Tests needed**:
  - [ ] Scene planning logic
  - [ ] Template generation
  - [ ] URL repair integration
  - [ ] LLM response handling

### Phase 3: Supporting Services **[MEDIUM PRIORITY]**

#### 3.1 Prompt Service
- **File**: `src/services/promptService.ts`
- **Tests needed**:
  - [ ] Template loading and parsing
  - [ ] Variable substitution
  - [ ] Error handling for missing templates

#### 3.2 Usage Tracking Service
- **File**: `src/services/usageTrackingService.ts`
- **Tests needed**:
  - [ ] Usage increment logic
  - [ ] Limit validation
  - [ ] Database operations

### Phase 4: Integration Tests **[LOWER PRIORITY]**

#### 4.1 Video Generation Pipeline
- **Purpose**: Test full video generation flow
- **Tests needed**:
  - [ ] End-to-end script to template conversion
  - [ ] Error propagation through pipeline
  - [ ] Performance under load

#### 4.2 API Endpoints
- **Tests needed**:
  - [ ] Authentication middleware
  - [ ] Request validation
  - [ ] Response formatting

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

This testing strategy ensures we maintain high code quality while focusing our efforts on the most critical parts of the video generation pipeline.