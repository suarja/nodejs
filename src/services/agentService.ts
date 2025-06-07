import { ScriptGenerator } from './scriptGenerator';
import { ScriptReviewer } from './scriptReviewer';
import { testOpenAIConnection, MODELS } from '../config/openai';

export class AgentService {
  private scriptGenerator: ScriptGenerator;
  private scriptReviewer: ScriptReviewer;
  private static instance: AgentService;

  private constructor() {
    this.scriptGenerator = ScriptGenerator.getInstance(MODELS['o4-mini']);
    this.scriptReviewer = ScriptReviewer.getInstance(MODELS['o4-mini']);
  }

  public static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * Test all agent connections and dependencies
   */
  async testConnections(): Promise<boolean> {
    try {
      console.log('🧪 Testing agent service connections...');

      const isOpenAIConnected = await testOpenAIConnection();

      if (!isOpenAIConnected) {
        console.error('❌ OpenAI connection failed');
        return false;
      }

      console.log('✅ All agent connections successful');
      return true;
    } catch (error) {
      console.error('❌ Agent service connection test failed:', error);
      return false;
    }
  }

  /**
   * Generate a script using the script generator agent
   */
  async generateScript(
    prompt: string,
    editorialProfile: any,
    systemPrompt: string
  ): Promise<string> {
    try {
      console.log('🎬 AgentService: Generating script...');
      return await this.scriptGenerator.generate(
        prompt,
        editorialProfile,
        systemPrompt
      );
    } catch (error) {
      console.error('❌ AgentService: Script generation failed:', error);
      throw error;
    }
  }

  /**
   * Review a script using the script reviewer agent
   */
  async reviewScript(
    script: string,
    editorialProfile: any,
    userSystemPrompt: string
  ): Promise<string> {
    try {
      console.log('🔍 AgentService: Reviewing script...');
      return await this.scriptReviewer.review(
        script,
        editorialProfile,
        userSystemPrompt
      );
    } catch (error) {
      console.error('❌ AgentService: Script review failed:', error);
      throw error;
    }
  }

  /**
   * Generate and review a script in one operation
   */
  async generateAndReviewScript(
    prompt: string,
    editorialProfile: any,
    systemPrompt: string
  ): Promise<{
    generatedScript: string;
    reviewedScript: string;
  }> {
    try {
      console.log('🎭 AgentService: Generating and reviewing script...');

      // Generate script
      const generatedScript = await this.generateScript(
        prompt,
        editorialProfile,
        systemPrompt
      );

      // Review the generated script
      const reviewedScript = await this.reviewScript(
        generatedScript,
        editorialProfile,
        systemPrompt
      );

      console.log('✅ AgentService: Script generation and review completed');

      return {
        generatedScript,
        reviewedScript,
      };
    } catch (error) {
      console.error('❌ AgentService: Generate and review failed:', error);
      throw error;
    }
  }
}
