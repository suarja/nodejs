/**
 * Types for prompt management system
 */

/**
 * Metadata for a prompt version
 */
export type PromptVersionMetadata = {
  version: string;
  updatedAt: string;
  changelog: string;
};

/**
 * Test case for a prompt
 */
export type PromptTestCase = {
  input: string;
  output: string;
  notes?: string;
};

/**
 * Evaluation metadata for a prompt
 */
export type PromptEvaluationMetadata = {
  score: number;
  criteria: string;
  lastTested: string;
};

/**
 * Prompt components (system, user, developer)
 */
export type PromptComponents = {
  system: string;
  user: string;
  developer?: string;
};

/**
 * Complete prompt definition
 */
export type PromptDefinition = {
  id: string;
  name: string;
  description: string;
  context: string;
  version: string;
  status: 'LATEST' | 'DEPRECATED' | 'DRAFT';
  createdAt: string;
  updatedAt: string;
  author: string;
  tags: string[];
  metadata: {
    notes?: string;
    evaluation?: PromptEvaluationMetadata;
    testCases?: PromptTestCase[];
  };
  prompts: PromptComponents;
  history: PromptVersionMetadata[];
};

/**
 * Complete prompt bank
 */
export type PromptBank = PromptDefinition[];

/**
 * Filled prompt template with variable substitution
 */
export type FilledPromptTemplate = {
  system: string;
  user: string;
  developer?: string;
};
