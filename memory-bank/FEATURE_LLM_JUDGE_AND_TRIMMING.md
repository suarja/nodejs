# Feature: LLM Judge & Granular Video Trimming

This document tracks the implementation of an advanced video generation pipeline that incorporates an "LLM as a Judge" for validation and uses detailed video analysis data for granular scene trimming.

## 1. Objectives

- **Increase Reliability**: Introduce a "judge" AI agent to validate and correct the output of the "creative" AI agent, specifically for scene planning and video asset selection.
- **Improve Video Quality**: Utilize pre-computed `analysis_data` from Gemini to select specific segments of a source video (`trim_start`, `trim_duration`) that best match the script, leading to more dynamic and relevant edits.
- **Robust Architecture**: Refactor the validation and repair logic into the `VideoUrlRepairer` service, following good Domain-Driven Design principles.
- **Structured Outputs**: Leverage Zod schemas and the OpenAI `responses.parse` API to enforce correctly formatted outputs from AI agents.

## 2. Plan of Action

### Phase 1: Foundational Enhancements (Zod & Trimming Schema)

1.  [ ] **Update Type Definitions (`types/video.ts`):**

    - Modify the `ScenePlanSchema` Zod schema.
    - Add `trim_start: z.string().optional()` and `trim_duration: z.string().optional()` to the `VideoAssetInPlanSchema` sub-schema.

2.  [ ] **Enhance Planner Agent (`CreatomateBuilder.planVideoStructure`):**

    - Update the system prompt to instruct the agent on how to use `analysis_data.segments`.
    - The agent must be instructed to use `start_time` and `end_time` to populate `trim_start` and `trim_duration` when a relevant segment is found.
    - The agent must be explicitly told to omit these fields if no `analysis_data` is available or no segment is relevant.

3.  [ ] **Enhance Template Agent (`CreatomateBuilder.generateTemplate`):**
    - Update the system prompt to instruct the agent to correctly transfer `trim_start` and `trim_duration` from the `scenePlan` to the final Creatomate JSON structure.

### Phase 2: AI-Powered Repair Logic (`VideoUrlRepairer`)

1.  [ ] **Refactor `VideoUrlRepairer`:**

    - Add an `OpenAI` client instance to the service.
    - Create a new public method: `repairScenePlanWithAI(scenePlan, logger)`.

2.  [ ] **Implement the "Judge" Logic:**
    - Inside `repairScenePlanWithAI`, implement a retry loop (max 3 attempts).
    - Create a private method that calls the "Judge" LLM.
    - This "Judge" will receive the potentially faulty `scenePlan` and the list of original `ValidatedVideo` objects.
    - Its goal is to return a corrected, valid `ScenePlan` object, using a Zod schema for response validation.
    - If the loop fails three times, throw a custom `ScenePlanRepairFailedError`.

### Phase 3: Integration & Final Validation

1.  [ ] **Integrate into `CreatomateBuilder.buildJson`:**

    - Instantiate `VideoUrlRepairer`.
    - After the initial `planVideoStructure` call, immediately call `urlRepairer.repairScenePlanWithAI` to validate and correct the plan.
    - Use the repaired `scenePlan` for the subsequent `generateTemplate` call.
    - Use the same `urlRepairer` instance to perform a final, deterministic `repairTemplate` call on the generated JSON to fix any lingering URL format issues.

2.  [ ] **Create a Final Validation Method:**
    - Create or enhance a final validation method (`validateAndFixTemplate`) in `CreatomateBuilder`.
    - This method will perform deterministic checks:
      - `fit` is `cover`.
      - `duration` is `null` on video elements.
      - No conflict between `trim_start` and `loop`.

## 3. Key Decisions

- The "LLM as a Judge" logic will reside within `VideoUrlRepairer` to centralize all repair/validation responsibilities.
- The system will be designed to be resilient, functioning correctly whether `analysis_data` is present or not.
- We will use `openai.responses.parse` with Zod schemas for all agent interactions to ensure structured and predictable data.
