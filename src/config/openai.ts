import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable');
  }

  return new OpenAI({
    apiKey: apiKey,
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
