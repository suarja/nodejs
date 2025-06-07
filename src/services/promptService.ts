import promptBankJson from '../config/prompt-bank.json';
import { PromptDefinition, PromptBank } from '../types/prompts';

/**
 * Service for managing prompts from the prompt bank
 */
export class PromptService {
  private static promptBank: PromptBank = promptBankJson as PromptBank;

  /**
   * Get a prompt by ID
   * @param promptId The ID of the prompt to retrieve
   * @returns The prompt definition or null if not found
   */
  static getPrompt(promptId: string): PromptDefinition | null {
    const prompt = this.promptBank.find((p) => p.id === promptId);
    return prompt || null;
  }

  /**
   * Get all prompts
   * @returns Array of all prompts
   */
  static getAllPrompts(): PromptDefinition[] {
    return this.promptBank;
  }

  /**
   * Get prompts by tag
   * @param tag Tag to filter by
   * @returns Array of prompts with the specified tag
   */
  static getPromptsByTag(tag: string): PromptDefinition[] {
    return this.promptBank.filter((prompt) => prompt.tags.includes(tag));
  }

  /**
   * Get the latest version of all prompts
   * @returns Array of latest prompt definitions
   */
  static getLatestPrompts(): PromptDefinition[] {
    return this.promptBank.filter((p) => p.status === 'LATEST');
  }

  /**
   * Fill a prompt template with values
   * @param promptId The ID of the prompt to fill
   * @param values The values to fill in the template
   * @returns The filled prompt components or null if prompt not found
   */
  static fillPromptTemplate(
    promptId: string,
    values: Record<string, any>
  ): { system: string; user: string; developer?: string } | null {
    const prompt = this.getPrompt(promptId);
    if (!prompt) return null;

    const fillTemplate = (
      template: string,
      values: Record<string, any>
    ): string => {
      let filledTemplate = template;
      Object.entries(values).forEach(([key, value]) => {
        const stringValue =
          typeof value === 'object'
            ? JSON.stringify(value, null, 2)
            : String(value);
        filledTemplate = filledTemplate.replace(
          new RegExp(`{${key}}`, 'g'),
          stringValue
        );
      });
      return filledTemplate;
    };

    return {
      system: fillTemplate(prompt.prompts.system, values),
      user: fillTemplate(prompt.prompts.user, values),
      developer: prompt.prompts.developer
        ? fillTemplate(prompt.prompts.developer, values)
        : undefined,
    };
  }
}
