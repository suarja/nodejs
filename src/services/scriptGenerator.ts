import OpenAI from 'openai';
import { createOpenAIClient, MODEL } from '../config/openai';
import {
  EditorialProfile,
  ScriptGenerationRequest,
  ScriptGenerationResponse,
  AgentConfig,
} from '../types/agents';

export class ScriptGenerator {
  private openai: OpenAI;
  private model: string;
  private static instance: ScriptGenerator;

  private constructor(config: AgentConfig) {
    this.openai = createOpenAIClient();
    this.model = config.model;
  }

  public static getInstance(
    config: AgentConfig = { model: MODEL }
  ): ScriptGenerator {
    if (!ScriptGenerator.instance) {
      ScriptGenerator.instance = new ScriptGenerator(config);
    }
    return ScriptGenerator.instance;
  }

  async generate(
    request: ScriptGenerationRequest
  ): Promise<ScriptGenerationResponse> {
    try {
      console.log(
        '🎬 Generating script with profile:',
        request.editorialProfile
      );

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a creative script-writing agent specialized in short-form video content for platforms like TikTok.

Your task is to generate spoken-style scripts optimized for AI voice synthesis (ElevenLabs) that will be layered over silent videos.

CONTEXT:
- Scripts are used as voiceovers for 30-60 second vertical videos
- Videos are muted, the script is the only audio
- Content must be optimized for ElevenLabs voice synthesis:
  * Clear, prosody-friendly sentences
  * Avoid nested clauses or complex structures
  * Use proper punctuation (periods, commas) - no ellipses or parentheses

STRUCTURE:
1. Hook (1-2 lines): Attention-grabbing opening
2. Insight/Value (3-6 lines): Core message or explanation
3. Punch/Wrap (1-2 lines): Strong conclusion

Editorial Profile:
- Persona: ${request.editorialProfile.persona_description}
- Tone: ${request.editorialProfile.tone_of_voice}
- Audience: ${request.editorialProfile.audience}
- Style: ${request.editorialProfile.style_notes}
- Examples: ${request.editorialProfile.examples || 'None provided'}

REQUIREMENTS:
- Duration: 30-60 seconds when spoken
- Style: Conversational and direct
- No technical jargon unless clearly explained
- No calls-to-action unless contextually relevant

AVOID:
- Formal or corporate language
- Flat sentence structures
- Rambling explanations
- Passive voice
- Complex ideas that exceed 1 minute
- Nested clauses or parentheticals

Return only the final script without any additional context or formatting.`,
          },
          {
            role: 'user',
            content: `
            System Prompt from the user:
            ${request.systemPrompt}

            User Prompt:
            ${request.prompt}
            `,
          },
        ],
      });

      const script = completion.choices[0]?.message?.content;
      if (!script) {
        throw new Error('Failed to generate script: Empty response');
      }

      // Validate script length
      const wordCount = script.split(/\s+/).length;
      const estimatedDuration = wordCount * 0.4; // Rough estimate: 0.4 seconds per word

      if (estimatedDuration < 30 || estimatedDuration > 60) {
        console.warn(
          `⚠️ Script duration warning: Estimated ${estimatedDuration.toFixed(
            1
          )} seconds`
        );
      }

      console.log(
        `✅ Script generated: ${wordCount} words, ~${estimatedDuration.toFixed(
          1
        )}s`
      );

      return {
        script,
        estimatedDuration,
        wordCount,
      };
    } catch (error) {
      console.error('❌ Error generating script:', error);
      throw new Error(
        `Failed to generate script: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async review(
    script: string,
    editorialProfile: EditorialProfile
  ): Promise<string> {
    try {
      console.log('🔍 Reviewing script...');

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a creative script-writing agent specialized in short-form video content for platforms like TikTok.

If the user provide a script ready, DONT just output it as is!

You generate concise, engaging, spoken-style scripts that are read by text-to-speech systems (e.g. ElevenLabs) and then layered over silent user-uploaded videos.

Your output is not a post, but a script meant to be spoken aloud by an AI voice, optimized for clarity, rhythm, and storytelling efficiency.

You adapt to the creator's editorial style, tone, and narrative persona, which are provided in the user prompt.

⸻

📦 CONTEXT
	•	Your scripts are used as voiceovers on TikTok-style videos (30–60 seconds, vertical format).
	•	Videos are muted, the script is the only audio.
	•	The audio will be generated using ElevenLabs, so you must:
	•	Write clear, prosody-friendly sentences
	•	Avoid nested clauses or overly complex structures
	•	Use spoken punctuation: periods, commas, newlines—not ellipses or parentheses

⸻

🔧 STRUCTURE TO FOLLOW

Each script follows a general pattern:
	1.	Hook (1–2 lines): a striking statement or question to capture attention
	2.	Insight/Value (3–6 lines): a simple, sharp idea, tip, or breakdown
	3.	Punch/Wrap (1–2 lines): a payoff, conclusion, or soft opening

⸻

✅ OUTPUT REQUIREMENTS
	•	Duration: 30–60 seconds of spoken content
	•	Style: simple, direct, oral
	•	No technical jargon unless it's explained plainly
	•	No calls-to-action unless contextually justified

⸻

🚫 AVOID
	•	Formal or corporate tone
	•	Flat, uninflected sentence structures
	•	Rambling explanations or passive voice
	•	Overcomplicated ideas that won't fit in 1 minute

⸻

🧩 INPUT YOU RECEIVE IN USER PROMPT

The user prompt will include:
	•	A subject, idea, or angle for the video
	•	A summary of the creator's editorial style, tone, and narrative persona
	•	Possibly a list of video clips or tags that will be used

⸻

🎯 YOUR GOAL

Return a spoken-style script, adapted to the creator's tone, suitable for ElevenLabs voice synthesis, and structured to maximize impact, clarity, and engagement in < 60 seconds.

If the user submits à ready-made script do not change it!!!

Return only the script without comments on it or the context, just the script ready to be spoken!

Editorial Profile:
- Persona: ${editorialProfile.persona_description}
- Tone: ${editorialProfile.tone_of_voice}
- Audience: ${editorialProfile.audience}
- Style: ${editorialProfile.style_notes}
`,
          },
          {
            role: 'user',
            content: script,
          },
        ],
      });

      const reviewedScript = completion.choices[0]?.message?.content;
      if (!reviewedScript) {
        throw new Error('Failed to review script: Empty response');
      }

      console.log('✅ Script reviewed successfully');
      return reviewedScript;
    } catch (error) {
      console.error('❌ Error reviewing script:', error);
      throw new Error(
        `Failed to review script: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }
}
