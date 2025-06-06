import promptBankJson from '../config/prompt-bank.json';
import {
  PromptDefinition,
  PromptBank,
  FilledPromptTemplate,
} from '../types/prompts';

/**
 * Service for managing and accessing prompts - matches mobile app implementation
 */
export class PromptService {
  private static prompts: PromptDefinition[] =
    promptBankJson as PromptDefinition[];

  /**
   * Get a prompt by ID
   * @param id The ID of the prompt to retrieve
   * @returns The prompt or null if not found
   */
  static getPrompt(id: string): PromptDefinition | null {
    return this.prompts.find((prompt) => prompt.id === id) || null;
  }

  /**
   * Get all prompts
   * @returns Array of all prompts
   */
  static getAllPrompts(): PromptDefinition[] {
    return this.prompts;
  }

  /**
   * Get prompts by tag
   * @param tag Tag to filter by
   * @returns Array of prompts with the specified tag
   */
  static getPromptsByTag(tag: string): PromptDefinition[] {
    return this.prompts.filter((prompt) => prompt.tags.includes(tag));
  }

  /**
   * Get the latest version of each prompt
   * @returns Array of latest prompts
   */
  static getLatestPrompts(): PromptDefinition[] {
    return this.prompts.filter((prompt) => prompt.status === 'LATEST');
  }

  /**
   * Fill a prompt template with provided values
   * @param id The ID of the prompt to fill
   * @param values Object containing values to substitute in the template
   * @returns Filled prompt template or null if prompt not found
   */
  static fillPromptTemplate(
    id: string,
    values: Record<string, any>
  ): FilledPromptTemplate | null {
    const prompt = this.getPrompt(id);
    if (!prompt) {
      return null;
    }

    const fillTemplate = (template: string): string => {
      return template.replace(/\{(\w+)\}/g, (match, key) => {
        if (key in values) {
          const value = values[key];
          // Handle JSON objects by stringifying them
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
          }
          return String(value);
        }
        return match; // Keep original placeholder if no value provided
      });
    };

    return {
      system: fillTemplate(prompt.prompts.system),
      user: fillTemplate(prompt.prompts.user),
      developer: prompt.prompts.developer
        ? fillTemplate(prompt.prompts.developer)
        : undefined,
    };
  }
}
