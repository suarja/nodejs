import { readFile } from "fs/promises";
import { join } from "path";
import OpenAI from "openai";
import { createOpenAIClient } from "../config/openai";
import { PromptService } from "./promptService";
import { convertCaptionConfigToProperties } from "../utils/video/preset-converter";
import { logger } from "../config/logger";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import {
  CaptionConfiguration,
  EditorialProfile,
  ScenePlan,
  ScenePlanSchema,
  ValidatedVideo,
} from "../types/video";
import { VideoUrlRepairer } from "./video/videoUrlRepairer";
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

  private async planVideoStructure(
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

  /**
   * Patch tous les éléments audio pour remplacer la clé 'text' par 'source' si besoin
   */
  private patchAudioTextToSource(template: any) {
    if (!template || !template.elements || !Array.isArray(template.elements))
      return;
    template.elements.forEach((scene: any) => {
      if (scene.elements && Array.isArray(scene.elements)) {
        scene.elements.forEach((element: any) => {
          if (element.type === "audio" && typeof element.text === "string") {
            // Si la clé 'text' existe, on la copie dans 'source' et on la supprime
            element.source = element.text;
            delete element.text;
            console.log(
              `🔧 Patch audio: remplacé 'text' par 'source' dans l'élément audio ${
                element.id || ""
              }`
            );
          }
        });
      }
    });
  }

  /**
   * Builds a Creatomate JSON template with enhanced caption support
   */
  async buildJson(params: {
    script: string;
    selectedVideos: ValidatedVideo[];
    voiceId: string;
    editorialProfile: EditorialProfile;
    captionStructure: any;
    agentPrompt: string;
    logger: winston.Logger;
  }): Promise<any> {
    params.logger.info("🚧 CreatomateBuilder.buildJson called with params:");
    params.logger.info(
      "Caption structure type:",
      typeof params.captionStructure
    );
    params.logger.info(
      "Caption structure content:",
      JSON.stringify(params.captionStructure, null, 2)
    );

    const urlRepairer = new VideoUrlRepairer(
      params.selectedVideos,
      params.logger
    );

    // Step 1: Plan the video structure (scene-by-scene)
    const scenePlan = await this.planVideoStructure(
      params.script,
      params.selectedVideos,
      params.logger
    );

    // Step 2: Validate and repair the scene plan with an AI Judge
    const repairedScenePlan = await urlRepairer.repairScenePlanWithAI(
      scenePlan,
      params.logger
    );

    // Step 3: Generate the Creatomate template
    const template = await this.generateTemplate({
      script: params.script,
      selectedVideos: params.selectedVideos,
      voiceId: params.voiceId,
      editorialProfile: params.editorialProfile,
      scenePlan: repairedScenePlan,
      captionStructure: params.captionStructure,
      agentPrompt: params.agentPrompt,
    });

    // Step 3.5: Patch audio elements (text -> source)
    this.patchAudioTextToSource(template);

    // Step 4: Final deterministic URL repair on the generated template
    urlRepairer.repairTemplate(template);

    // Step 5: Fix other template issues (e.g., video.fit)
    this.fixTemplate(template);

    // Step 6: Handle caption configuration (enhanced logic)
    this.handleCaptionConfiguration(template, params.captionStructure);

    // Step 7: Validate the template
    this.validateTemplate(template);

    // Log repair summary
    const repairSummary = urlRepairer.getRepairSummary();
    if (repairSummary.totalCorrections > 0) {
      params.logger.info("📋 URL repairs completed:", repairSummary);
      params.logger.info(
        "📋 Detailed corrections:",
        urlRepairer.getCorrections()
      );
    } else {
      params.logger.info("✅ No URL repairs needed - all URLs were correct");
    }

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
      throw new Error("Invalid template: Missing required properties");
    }

    // Validate dimensions for TikTok format
    if (template.width !== 1080 || template.height !== 1920) {
      throw new Error("Invalid template: Must be 1080x1920 for vertical video");
    }

    // Validate scenes
    if (!Array.isArray(template.elements)) {
      throw new Error("Invalid template: elements must be an array");
    }

    console.log("✅ Template validation passed");
  }

  /* A function to post process the template to fix the elements. Exactly the video.fit:

  Error Details:
Source error: Video.fit: Expected one of these values: cover, contain, fill
  We should enforce the fit to be cover

}
  */
  private fixTemplate(template: any) {
    // Fix the elements.video.fit to be cover and duration to be null
    template.elements.forEach((element: any) => {
      element.elements.forEach((element: any) => {
        if (element.type === "video") {
          console.log("🚧 Fixing video.fit to cover 🚧");
          element.fit = "cover";

          // Ensure video duration is null to limit video to caption/voiceover length
          console.log(
            "🚧 Setting video.duration to null for TikTok optimization 🚧"
          );
          element.duration = null;
        }
      });
    });
  }

  /**
   * Handle caption configuration with simplified logic
   */
  private handleCaptionConfiguration(template: any, captionConfig: any) {
    // If no caption config provided, apply default configuration
    console.log(
      "🚧 handleCaptionConfiguration called with captionConfig:",
      JSON.stringify(captionConfig, null, 2)
    );
    if (!captionConfig) {
      console.log("🚧 No caption configuration provided, using default 🚧");
      const defaultConfig = {
        enabled: true,
        presetId: "karaoke",
        placement: "bottom",
        transcriptColor: "#04f827",
        transcriptEffect: "karaoke",
      };
      this.fixCaptions(template, defaultConfig);
      return;
    }

    // Check if captions are disabled
    if (captionConfig.enabled === false) {
      console.log(
        "🚧 Captions are disabled, removing all subtitle elements 🚧"
      );
      this.disableCaptions(template);
      return;
    }

    // Apply caption configuration
    console.log("🚧 Applying caption configuration to template 🚧");
    this.fixCaptions(template, captionConfig);
  }

  /**
   * Remove all caption elements from the template
   */
  private disableCaptions(template: any) {
    console.log("Disabling captions - removing all subtitle elements");

    template.elements.forEach((scene: any) => {
      scene.elements = scene.elements.filter((element: any) => {
        const isSubtitle =
          element.type === "text" &&
          element.name &&
          element.name.toLowerCase().includes("subtitle");

        if (isSubtitle) {
          console.log(`Removing subtitle element: ${element.name}`);
        }

        return !isSubtitle;
      });
    });
  }

  private fixCaptions(template: any, captionConfig: any) {
    console.log("🚧 Fixing captions with direct config approach 🚧");

    // Get the properties to apply from the caption configuration
    const captionProperties = convertCaptionConfigToProperties(
      captionConfig,
      logger
    );
    console.log(
      "🚧 Applying caption properties:",
      JSON.stringify(captionProperties, null, 2)
    );

    // Apply caption configuration to all text elements
    template.elements.forEach((scene: any) => {
      scene.elements.forEach((element: any) => {
        if (
          element.type === "text" &&
          element.name &&
          element.name.toLowerCase().includes("subtitle")
        ) {
          // Remove conflicting old format properties that can interfere
          const conflictingProperties = [
            "x",
            "y", // Old positioning format
            "highlight_color", // Should be transcript_color
            "shadow_x",
            "shadow_y",
            "shadow_blur",
            "shadow_color", // Legacy shadow properties
            "text_transform", // Can conflict with Creatomate's text handling
          ];

          conflictingProperties.forEach((prop) => {
            delete element[prop];
          });

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

          console.log(`🚧 Applied captions to element ${element.id}:`, {
            transcript_color: element.transcript_color,
            transcript_effect: element.transcript_effect,
            y_alignment: element.y_alignment,
          });
        }
      });
    });
  }
}
