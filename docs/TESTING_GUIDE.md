# Testing Guide: Video Generation Service

This document outlines the testing strategy for the `server-primary` service, with a focus on the video generation pipeline handled by `CreatomateBuilder`.

## Testing Philosophy

We employ a two-tiered testing approach to ensure both logical correctness and real-world reliability:

1.  **Integration Tests**: These tests verify that the different components of our application work together correctly in a controlled environment. They are fast, reliable, and do not depend on external services.
2.  **End-to-End (E2E) Tests**: These tests validate the entire workflow against live, external services (like the OpenAI API). They are slower and require API keys but provide the ultimate confirmation that our system works as expected in a production-like scenario.

---

## Test Suites

### 1. Integration Test: `CreatomateBuilder`

- **File**: `tests/services/creatomateBuilder.test.ts`
- **Purpose**: To verify the internal logic of the `CreatomateBuilder` and its interaction with the `VideoUrlRepairer`.
- **Methodology**:
  - The OpenAI API is **mocked**. We don't make real API calls.
  - We simulate a realistic sequence of LLM responses:
    1.  A "planner" LLM returns a `scenePlan` with an intentionally incorrect video URL.
    2.  An "AI judge" LLM returns a corrected `scenePlan` with the proper URL and added video trim properties.
    3.  A "template generator" LLM returns a final Creatomate JSON.
  - The test asserts that the final template correctly incorporates the repaired data, proving that our AI-driven repair and enhancement logic is sound.

### 2. End-to-End Test: `CreatomateBuilder`

- **File**: `tests/services/creatomateBuilder.e2e.test.ts`
- **Purpose**: To validate the entire video generation data flow against the **live OpenAI API**.
- **Methodology**:
  - This test makes **real API calls** to OpenAI using the `OPENAI_API_KEY` from your environment variables.
  - It sends a real script and a list of video assets and expects the `CreatomateBuilder` to return a valid, structurally correct Creatomate template.
  - The test validates the final template's structure and ensures the video URLs are correct.
  - **Note**: This test is automatically skipped if the `OPENAI_API_KEY` is not found in the environment.

---

## How to Run Tests

You can run tests using the scripts defined in `package.json`.

### Run All Tests

This will execute both the integration and E2E tests (if the API key is present).

```bash
npm test
```

### Run Only Integration Tests

This is the fastest way to check for logical regressions.

```bash
npm run test:integration
```

### Run Only End-to-End Tests

Use this to verify the live integration with the OpenAI API.

```bash
npm run test:e2e
```
