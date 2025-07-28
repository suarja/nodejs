import { readFile } from "fs/promises";
import { join } from "path";
import OpenAI from "openai";
import { createOpenAIClient } from "../config/openai";
import { PromptService } from "./promptService";
import { zodTextFormat } from "openai/helpers/zod";
import {
  ScenePlan,
  ScenePlanSchema,
  ValidatedVideo,
} from "../types/video";
import winston from "winston";

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
      const docsPath = join(process.cwd(), "docs", "creatomate.md");
      this.docsCache = await readFile(docsPath, "utf-8");
      return this.docsCache;
    } catch (error) {
      console.error("Error loading Creatomate docs:", error);
      throw new Error("Failed to load Creatomate documentation");
    }
  }

  /**
   * Plan video structure with scene-by-scene breakdown
   * Now PUBLIC for VideoTemplateService to call directly
   */
  async planVideoStructure(
    script: string,
    selectedVideos: ValidatedVideo[],
    logger: winston.Logger
  ): Promise<ScenePlan> {
    const systemInstructions = `You are a video planning expert. Your PRIMARY GOAL is to create a scene-by-scene plan that ALWAYS uses the available video assets.

CRITICAL RULES:
1.  EVERY scene MUST be assigned a video asset from the provided list.
2.  NO scenes should be left without a video asset (video_asset: null is FORBIDDEN).
3.  You can reuse video assets across multiple scenes if needed.
4.  Match video assets to script content based on keywords, themes, or general relevance.

**NEW: VIDEO SEGMENT SELECTION (TRIMMING):**
1.  When a video in the "Available videos" list contains an \`analysis_data\` object, you MUST inspect its \`segments\` array.
2.  For the current script scene, find the **best matching segment** from the \`analysis_data\` by comparing the \`script_text\` with the segment's \`key_points\` or \`description\`.
3.  If you find a matching segment, you MUST use its \`start_time\` and \`end_time\` to set \`trim_start\` and \`trim_duration\` for that video asset in your response.
    -   Example: "start_time": "00:05", "end_time": "00:12" -> "trim_start": "5", "trim_duration": "7".
    -   Calculate trim_duration by subtracting start_time from end_time.
4.  **CRITICAL**: If a video does **NOT** have \`analysis_data\`, or if no segment is relevant, you **MUST NOT** include \`trim_start\` or \`trim_duration\` for that asset. Leave them undefined.
5. **Estimate Voiceover Duration**: For each scene, estimate the spoken duration of the audio source text. The formula to calculate this is to multiply the number of words by 0.9 to get the duration in seconds.  
6.  **Compare with Video Duration**: Compare the voiceover duration to the duration of the video asset provided in the <scenePlan/>. The video's duration is determined by its \`trim_duration\` property if it exists.
7.  **Handle Insufficient Video Duration**:\n    - **IF** the video duration is SHORTER than the estimated voiceover duration, you MUST add more video content to cover the gap.\n    - **How to Add More Video**: Add one or more additional \`video\` elements within the same scene \`composition\`. Select relevant clips from the full \`{selectedVideos}\` list. Place these additional video elements on \`track: 1\` to play sequentially after the primary video by adjusting their \`time\` property.\n    - **IF** no \`trim_duration\` is specified for the primary video, you can simply set its \`duration\` to \`null\`, which will automatically stretch it to the length of the voiceover. This is the preferred method when no specific trim is required.\n\n# 6. Concrete 'Living' Example\nHere is a real-world example of the first two scenes of a final JSON template.
Return a JSON object with an array of scenes.

CRITICAL: The video_asset.url MUST be the exact URL from the available videos list.`;
    const userInstructions = `Script: ${script}

Available videos: ${JSON.stringify(selectedVideos, null, 2)}

REMEMBER: Every scene MUST have a video_asset assigned. Never leave video_asset as null.`;

    const response = await this.openai.responses.parse({
      model: this.model,
      input: [
        {
          role: "system",
          content: systemInstructions,
        },
        {
          role: "user",
          content: userInstructions,
        },
      ],
      text: {
        format: zodTextFormat(ScenePlanSchema, "video_plan"),
      },
    });

    logger.info("Planning completion:", response.output_parsed);
    if (!response.output_parsed) {
      logger.error("Failed to plan video structure", response.error?.message);
      throw new Error("Failed to plan video structure");
    }
    return response.output_parsed;
  }

  /**
   * Generate Creatomate template from scene plan
   * Now PUBLIC for VideoTemplateService to call directly
   */
  async generateTemplate(params: {
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
    let userPrompt = "";

    if (!systemPrompt) {
      // Get the creatomate-builder-agent prompt from the prompt bank
      const promptTemplate = PromptService.fillPromptTemplate(
        "creatomate-builder-agent",
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
            : "",
        }
      );

      if (!promptTemplate) {
        console.warn("Prompt template not found, using default system prompt");
        systemPrompt = `
Tu es un expert en génération de vidéos avec Creatomate via JSON.

🎯 OBJECTIF PRINCIPAL
Tu dois générer un fichier JSON **valide, complet et sans erreur**, destiné à générer une vidéo TikTok à partir d'un plan de scènes détaillé.

🚨 RÈGLES CRITIQUES - VIDEO FIRST APPROACH
1.  **CHAQUE SCÈNE DOIT CONTENIR EXACTEMENT 3 ÉLÉMENTS :**
    *   1 élément vidéo ('type: "video"'). Utilise EXACTEMENT l'URL fournie dans le \`video_asset\` de la scène.
    *   1 voiceover IA ('type: "audio"').
    *   1 sous-titre dynamique ('type: "text"' avec transcript_source).
2.  **TRIMMING**: Si le \`video_asset\` d'une scène contient \`trim_start\` et \`trim_duration\`, tu DOIS les ajouter à l'élément vidéo correspondant dans le JSON final.
3.  **VOLUME**: Chaque élément VIDÉO doit avoir un volume de 0% pour ne pas interférer avec le voiceover.
`;
        userPrompt = `Script: ${params.script}

Scene Plan (Source of Truth): ${JSON.stringify(params.scenePlan, null, 2)}

Voice ID: ${params.voiceId}

${
  params.captionStructure
    ? `\n\nUTILISE CETTE STRUCTURE EXACTE POUR LES SOUS-TITRES:\n${JSON.stringify(
        params.captionStructure,
        null,
        2
      )}`
    : ""
}

Documentation Creatomate:
${docs}
 
Génère le JSON Creatomate pour cette vidéo, en utilisant EXACTEMENT les assets vidéo et les instructions de trim du scene plan.`;
      } else {
        systemPrompt = promptTemplate.system;
        userPrompt = promptTemplate.user;

        // Add documentation if not already included in the prompt
        if (!userPrompt.includes("Documentation Creatomate")) {
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
    : ""
}

Documentation Creatomate:
${docs}
 
Génère le JSON Creatomate pour cette vidéo, en utilisant EXACTEMENT les assets vidéo assignés dans le scene plan. Chaque scène doit avoir une vidéo, un voiceover, et des sous-titres.`;
    }

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    return JSON.parse(completion.choices[0]?.message.content || "{}");
  }


  
}
