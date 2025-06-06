import { ScriptGenerator } from './scriptGenerator';
import { ScriptReviewer } from './scriptReviewer';
import { testOpenAIConnection } from '../config/openai';
import {
  ScriptGenerationRequest,
  ScriptGenerationResponse,
  ScriptReviewRequest,
  ScriptReviewResponse,
  AgentConfig,
} from '../types/agents';

export class AgentService {
  private scriptGenerator: ScriptGenerator;
  private scriptReviewer: ScriptReviewer;
  private static instance: AgentService;

  private constructor(config?: AgentConfig) {
    this.scriptGenerator = ScriptGenerator.getInstance(config);
    this.scriptReviewer = ScriptReviewer.getInstance(config);
  }

  public static getInstance(config?: AgentConfig): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService(config);
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
    request: ScriptGenerationRequest
  ): Promise<ScriptGenerationResponse> {
    try {
      console.log('🎬 AgentService: Generating script...');
      return await this.scriptGenerator.generate(request);
    } catch (error) {
      console.error('❌ AgentService: Script generation failed:', error);
      throw error;
    }
  }

  /**
   * Review a script using the script reviewer agent
   */
  async reviewScript(
    request: ScriptReviewRequest
  ): Promise<ScriptReviewResponse> {
    try {
      console.log('🔍 AgentService: Reviewing script...');
      return await this.scriptReviewer.review(request);
    } catch (error) {
      console.error('❌ AgentService: Script review failed:', error);
      throw error;
    }
  }

  /**
   * Generate and review a script in one operation
   */
  async generateAndReviewScript(
    generationRequest: ScriptGenerationRequest
  ): Promise<{
    generation: ScriptGenerationResponse;
    review: ScriptReviewResponse;
  }> {
    try {
      console.log('🎭 AgentService: Generating and reviewing script...');

      // Generate script
      const generation = await this.generateScript(generationRequest);

      // Review the generated script
      const reviewRequest: ScriptReviewRequest = {
        script: generation.script,
        editorialProfile: generationRequest.editorialProfile,
        userSystemPrompt: generationRequest.systemPrompt,
      };

      const review = await this.reviewScript(reviewRequest);

      console.log('✅ AgentService: Script generation and review completed');

      return {
        generation,
        review,
      };
    } catch (error) {
      console.error('❌ AgentService: Generate and review failed:', error);
      throw error;
    }
  }
}
