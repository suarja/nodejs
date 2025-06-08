import { readFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';
import { createOpenAIClient } from '../config/openai';
import { PromptService } from './promptService';
import { convertCaptionConfigToProperties } from '../utils/video/preset-converter';

export class CreatomateBuilder {
  private static instance: CreatomateBuilder;
  private docsCache: string | null = null;
  private openai: OpenAI;
  private model: string;

  private constructor(model: string) {
    this.openai = createOpenAIClient();
    this.model = model;
  }

  static getInstance(model: string): CreatomateBuilder {
    if (!CreatomateBuilder.instance) {
      CreatomateBuilder.instance = new CreatomateBuilder(model);
    }
    return CreatomateBuilder.instance;
  }

  private async loadDocs(): Promise<string> {
    if (this.docsCache) {
      return this.docsCache;
    }

    try {
      const docsPath = join(process.cwd(), 'docs', 'creatomate.md');
      this.docsCache = await readFile(docsPath, 'utf-8');
      return this.docsCache;
    } catch (error) {
      console.error('Error loading Creatomate docs:', error);
      throw new Error('Failed to load Creatomate documentation');
    }
  }

  private async planVideoStructure(
    script: string,
    selectedVideos: any[]
  ): Promise<any> {
    console.log('Available videos:', JSON.stringify(selectedVideos, null, 2));
    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: `You are a video planning expert. Your PRIMARY GOAL is to create a scene-by-scene plan that ALWAYS uses the available video assets.

CRITICAL RULES:
1. EVERY scene MUST be assigned a video asset from the provided list
2. NO scenes should be left without a video asset (video_asset: null is FORBIDDEN)
3. You can reuse video assets across multiple scenes if needed
4. Match video assets to script content based on keywords, themes, or general relevance
5. If a video seems unrelated, still assign it - we prioritize video content over perfect matching

For each scene, determine:
1. Natural break points in the script (aim for 3-7 scenes total)
2. Which video asset best matches the content (REQUIRED - never null)
3. Brief reasoning for the video choice
4. Any timing or transition notes

Available videos format: [{ id: "...", url: "...", title: "...", description: "...", tags: [...] }]

Return a JSON object with an array of scenes. Each scene MUST have a video_asset assigned.

OUTPUT FORMAT:
{
  "scenes": [
    {
      "scene_number": 1,
      "script_text": "Text for this scene",
      "video_asset": {
        "id": "video_id",
        "url": "actual_video_url_from_available_videos",
        "title": "video_title"
      },
      "reasoning": "Why this video was chosen"
    }
  ]
}

CRITICAL: The video_asset.url MUST be the exact URL from the available videos list.`,
        },
        {
          role: 'user',
          content: `Script: ${script}

Available videos: ${JSON.stringify(selectedVideos, null, 2)}

REMEMBER: Every scene MUST have a video_asset assigned. Never leave video_asset as null.`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    console.log('Planning completion:', completion.choices[0]?.message.content);
    return JSON.parse(completion.choices[0]?.message.content || '{}');
  }

  private async generateTemplate(params: {
    script: string;
    selectedVideos: any[];
    voiceId: string;
    editorialProfile: any;
    scenePlan: any;
    captionStructure?: any;
    agentPrompt?: string;
  }): Promise<any> {
    const docs = await this.loadDocs();

    // Use the provided system prompt or get from prompt bank
    let systemPrompt = params.agentPrompt;
    let userPrompt = '';

    if (!systemPrompt) {
      // Get the creatomate-builder-agent prompt from the prompt bank
      const promptTemplate = PromptService.fillPromptTemplate(
        'creatomate-builder-agent',
        {
          script: params.script,
          scenePlan: JSON.stringify(params.scenePlan, null, 2),
          voiceId: params.voiceId,
          captionInfo: params.captionStructure
            ? `\n\nUTILISE CETTE STRUCTURE EXACTE POUR LES SOUS-TITRES:\n${JSON.stringify(
                params.captionStructure,
                null,
                2
              )}`
            : '',
        }
      );

      if (!promptTemplate) {
        console.warn('Prompt template not found, using default system prompt');
        systemPrompt = `
Tu es un expert en génération de vidéos avec Creatomate via JSON.

🎯 OBJECTIF PRINCIPAL
Tu dois générer un fichier JSON **valide, complet et sans erreur**, destiné à générer une vidéo TikTok à partir de :
- un script découpé en scènes avec des assets vidéo assignés
- une liste d'assets vidéo préexistants

🚨 RÈGLES CRITIQUES - VIDEO FIRST APPROACH
1. **CHAQUE SCÈNE DOIT CONTENIR EXACTEMENT 3 ÉLÉMENTS :**
   - 1 élément vidéo ('type: "video"') - OBLIGATOIRE
   - 1 voiceover IA ('type: "audio"') - OBLIGATOIRE  
   - 1 sous-titre dynamique ('type: "text"' avec transcript_source) - OBLIGATOIRE
   - Chaque élément VIDÉO doit avoir un volume de 0% afin de ne pas interférer avec le voiceover
`;
        userPrompt = `Script: ${params.script}

Scene Plan: ${JSON.stringify(params.scenePlan, null, 2)}

Voice ID: ${params.voiceId}

${
  params.captionStructure
    ? `\n\nUTILISE CETTE STRUCTURE EXACTE POUR LES SOUS-TITRES:\n${JSON.stringify(
        params.captionStructure,
        null,
        2
      )}`
    : ''
}

Documentation Creatomate:
${docs}
 
Génère le JSON Creatomate pour cette vidéo, en utilisant EXACTEMENT les assets vidéo assignés dans le scene plan. Chaque scène doit avoir une vidéo, un voiceover, et des sous-titres.`;
      } else {
        systemPrompt = promptTemplate.system;
        userPrompt = promptTemplate.user;

        // Add documentation if not already included in the prompt
        if (!userPrompt.includes('Documentation Creatomate')) {
          userPrompt += `\n\nDocumentation Creatomate:\n${docs}`;
        }
      }
    } else {
      // If system prompt is provided, still need to create user prompt
      userPrompt = `Script: ${params.script}

Scene Plan: ${JSON.stringify(params.scenePlan, null, 2)}

Voice ID: ${params.voiceId}

${
  params.captionStructure
    ? `\n\nUTILISE CETTE STRUCTURE EXACTE POUR LES SOUS-TITRES:\n${JSON.stringify(
        params.captionStructure,
        null,
        2
      )}`
    : ''
}

Documentation Creatomate:
${docs}
 
Génère le JSON Creatomate pour cette vidéo, en utilisant EXACTEMENT les assets vidéo assignés dans le scene plan. Chaque scène doit avoir une vidéo, un voiceover, et des sous-titres.`;
    }

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    return JSON.parse(completion.choices[0]?.message.content || '{}');
  }

  /**
   * Builds a Creatomate JSON template
   */
  async buildJson(params: {
    script: string;
    selectedVideos: any[];
    voiceId: string;
    editorialProfile?: any;
    captionStructure?: any;
    agentPrompt?: string;
  }): Promise<any> {
    console.log('Building Creatomate JSON template...');
    console.log('Voice ID:', params.voiceId);
    console.log(
      'Caption structure:',
      params.captionStructure ? 'Provided' : 'Not provided'
    );

    // Step 1: Plan the video structure (scene-by-scene)
    const scenePlan = await this.planVideoStructure(
      params.script,
      params.selectedVideos
    );

    // Step 2: Generate the Creatomate template
    const template = await this.generateTemplate({
      script: params.script,
      selectedVideos: params.selectedVideos,
      voiceId: params.voiceId || 'NFcw9p0jKu3zbmXieNPE', // Default voice if not provided
      editorialProfile: params.editorialProfile,
      scenePlan,
      captionStructure: params.captionStructure,
      agentPrompt: params.agentPrompt,
    });

    // Step 3: Fix template issues (e.g., video.fit)
    this.fixTemplate(template);

    // Step 4: Fix caption configuration if provided
    if (params.captionStructure) {
      this.fixCaptions(template, params.captionStructure);
    }

    // Step 5: Validate the template
    this.validateTemplate(template);

    return template;
  }

  private validateTemplate(template: any) {
    // Basic structure validation
    if (
      !template.output_format ||
      !template.width ||
      !template.height ||
      !template.elements
    ) {
      throw new Error('Invalid template: Missing required properties');
    }

    // Validate dimensions for TikTok format
    if (template.width !== 1080 || template.height !== 1920) {
      throw new Error('Invalid template: Must be 1080x1920 for vertical video');
    }

    // Validate scenes
    if (!Array.isArray(template.elements)) {
      throw new Error('Invalid template: elements must be an array');
    }

    console.log('✅ Template validation passed');
  }

  /* A function to post process the template to fix the elements. Exactly the video.fit:

  Error Details:
Source error: Video.fit: Expected one of these values: cover, contain, fill
  We should enforce the fit to be cover

}
  */
  private fixTemplate(template: any) {
    // Fix the elements.video.fit to be cover
    template.elements.forEach((element: any) => {
      element.elements.forEach((element: any) => {
        if (element.type === 'video') {
          element.fit = 'cover';
        }
      });
    });
  }

  private fixCaptions(template: any, captionConfig: any) {
    // Import the preset converter utility

    // Get the properties to apply from the caption configuration
    const captionProperties = convertCaptionConfigToProperties(captionConfig);

    // Apply caption configuration to all text elements
    template.elements.forEach((scene: any) => {
      scene.elements.forEach((element: any) => {
        if (
          element.type === 'text' &&
          element.name &&
          element.name.toLowerCase().includes('subtitle')
        ) {
          // Preserve critical properties that should not be overwritten
          const preservedProperties = {
            id: element.id,
            name: element.name,
            type: element.type,
            track: element.track,
            time: element.time,
            duration: element.duration,
            transcript_source: element.transcript_source, // Critical: preserve the audio source link
          };

          // Apply all caption properties, then restore preserved ones
          Object.assign(element, captionProperties, preservedProperties);
        }
      });
    });
  }
}
