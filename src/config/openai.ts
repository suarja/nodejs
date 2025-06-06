import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const MODELS = {
  o3: 'o3-2025-04-16',
  'o4-mini': 'o4-mini-2025-04-16',
  '4.1': 'gpt-4.1-2025-04-14',
  '4.1-nano': 'gpt-4.1-nano-2025-04-14',
};

const MODEL = MODELS['o4-mini'];

export function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Test OpenAI connection
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    const client = createOpenAIClient();

    // Simple test request
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'Hello' }],
      max_completion_tokens: 5,
    });

    if (response.choices && response.choices.length > 0) {
      console.log('✅ OpenAI connection successful');
      return true;
    }

    console.error('❌ OpenAI connection test failed: No response');
    return false;
  } catch (error) {
    console.error('❌ OpenAI connection test error:', error);
    return false;
  }
}

export { MODEL };
