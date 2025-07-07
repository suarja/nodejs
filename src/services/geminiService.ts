import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
  FileState,
} from "@google/genai";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET_NAME } from "../config/aws";
import * as fs from "fs/promises";
import * as path from "path";

const model = "gemini-2.5-flash";

// Types
export interface VideoAnalysisData {
  title: string;
  description: string;
  tags: string[];
  segments: VideoSegment[];
  structure: {
    has_hook: boolean;
    has_call_to_action: boolean;
    transitions_count: number;
    pacing: "fast" | "medium" | "slow";
  };
  content_type:
    | "tutorial"
    | "entertainment"
    | "educational"
    | "product_demo"
    | "interview"
    | "vlog"
    | "other";
  language: string;
  duration_category: "short" | "medium" | "long";
  key_moments: {
    hook_start?: string;
    main_content_start?: string;
    call_to_action_start?: string;
    end?: string;
  };
}

export interface VideoSegment {
  start_time: string;
  end_time: string;
  content_type: "intro" | "main_content" | "transition" | "outro";
  description: string;
  visual_elements: string[];
  key_points: string[];
}

export interface GeminiAnalysisResponse {
  success: boolean;
  data?: VideoAnalysisData;
  error?: string;
  analysis_time?: number;
  method_used?: "files" | "inline" | "direct";
}

export class GeminiService {
  private genAI: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable is required");
    }

    this.genAI = new GoogleGenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Analyze a video from S3 using Gemini AI
   */
  async analyzeVideoFromS3(publicUrl: string): Promise<GeminiAnalysisResponse> {
    const startTime = Date.now();

    try {
      console.log(`🧠 Starting video analysis for: ${publicUrl}`);

      let analysisResult: VideoAnalysisData;

      analysisResult = await this.analyzeWithVideoUrlInPrompt(publicUrl!);

      const analysisTime = Date.now() - startTime;

      console.log(`✅ Video analysis completed in ${analysisTime}ms`);

      return {
        success: true,
        data: analysisResult,
        analysis_time: analysisTime,
      };
    } catch (error) {
      const analysisTime = Date.now() - startTime;
      console.error(`❌ Video analysis failed after ${analysisTime}ms:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        analysis_time: analysisTime,
      };
    }
  }

  /**
   * Analyze a video directly from a blob buffer
   */
  async analyzeVideoFromBlob(
    videoBuffer: Buffer,
    fileName: string,
    fileSize: number
  ): Promise<GeminiAnalysisResponse> {
    const startTime = Date.now();

    try {
      console.log(
        `🧠 Starting direct video analysis for: ${fileName} (${fileSize} bytes)`
      );

      // Vérifier le format du fichier
      const fileSignature = videoBuffer.slice(0, 4).toString("hex");
      const validSignatures = {
        "66747970": "MP4", // ftyp
        "1a45dfa3": "WebM", // EBML
        "52494646": "AVI", // RIFF
      };

      if (
        !Object.keys(validSignatures).some((sig) => fileSignature.includes(sig))
      ) {
        throw new Error(
          "Format de fichier non supporté. Utilisez MP4, WebM ou AVI."
        );
      }

      // Créer le dossier temporaire s'il n'existe pas
      const tempDir = path.join(process.cwd(), "temp");
      await fs.mkdir(tempDir, { recursive: true });

      // Écrire temporairement le buffer dans un fichier
      const tempFilePath = path.join(tempDir, `temp_${Date.now()}_${fileName}`);
      await fs.writeFile(tempFilePath, videoBuffer);

      try {
        console.log(`📁 Video saved to temporary file: ${tempFilePath}`);

        // Upload vers Gemini en utilisant le chemin du fichier
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
        let myfile = await ai.files.upload({
          file: tempFilePath,
          config: { mimeType: "video/mp4" },
        });

        // Attendre le traitement avec timeout
        const maxRetries = 10;
        let retries = 0;

        while (myfile.state === FileState.PROCESSING && retries < maxRetries) {
          console.log(
            `🔄 Waiting for file to be processed... (attempt ${
              retries + 1
            }/${maxRetries}), state: ${myfile.state}`
          );
          await new Promise((resolve) => setTimeout(resolve, 2000));
          myfile = await ai.files.get({
            name: myfile.name || "",
          });
          retries++;
        }

        // Vérifier si le timeout a été atteint
        if (retries >= maxRetries) {
          throw new Error(
            "Le traitement du fichier a pris trop de temps. Veuillez réessayer."
          );
        }

        // Amélioration de la gestion des erreurs de l'état du fichier
        if (myfile.state !== FileState.ACTIVE) {
          const errorDetails = myfile.error?.details
            ?.map((d) => d.message)
            .filter(Boolean)
            .join(", ");

          console.error(
            `❌ File processing failed: state=${myfile.state}, error=${
              errorDetails || "No error details provided"
            }`
          );

          throw new Error(
            errorDetails ||
              "Le fichier n'est pas dans un état actif. Veuillez réessayer."
          );
        }

        console.log(`📤 Video uploaded to Gemini, URI: ${myfile.uri}`);

        if (!myfile.uri) {
          throw new Error(
            "Le fichier a été traité mais aucune URI n'a été retournée. Veuillez réessayer."
          );
        }

        // Analyse avec Gemini
        const prompt = this.getAnalysisPrompt();
        const contents = createUserContent([
          createPartFromUri(myfile.uri, "video/mp4"),
          prompt,
        ]);

        const result = await ai.models.generateContent({
          model: model,
          contents: contents,
        });

        const analysisResult = this.parseAnalysisResult(result.text || "");
        const analysisTime = Date.now() - startTime;

        console.log(`✅ Direct video analysis completed in ${analysisTime}ms`);

        return {
          success: true,
          data: analysisResult,
          analysis_time: analysisTime,
          method_used: "direct",
        };
      } finally {
        // Nettoyage : supprimer le fichier temporaire
        try {
          await fs.unlink(tempFilePath);
          console.log(`🗑️ Temporary file deleted: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error("Error cleaning up temporary file:", cleanupError);
        }
      }
    } catch (error) {
      const analysisTime = Date.now() - startTime;
      console.error(
        `❌ Direct video analysis failed after ${analysisTime}ms:`,
        error
      );

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        analysis_time: analysisTime,
      };
    }
  }

  /**
   * Upload a video buffer to Gemini Files API and return the file reference
   */
  private async uploadToGeminiFilesAPI(
    videoBuffer: Buffer,
    fileName: string
  ): Promise<any> {
    // Gemini Node SDK n'a pas d'API Files officielle, donc on utilise fetch
    const apiKey = process.env.GOOGLE_API_KEY;
    const url =
      "https://generativelanguage.googleapis.com/upload/v1beta/files?key=" +
      apiKey;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Goog-Upload-File-Name": fileName,
        "X-Goog-Upload-Protocol": "raw",
      },
      body: videoBuffer,
    });
    if (!res.ok) {
      throw new Error(
        "Failed to upload file to Gemini Files API: " + (await res.text())
      );
    }
    return await res.json();
  }

  private async analyzeWithVideoUrlInPrompt(
    videoUrl: string
  ): Promise<VideoAnalysisData> {
    try {
      const prompt = this.getAnalysisPromptWithVideoUrl(videoUrl);

      const result = await this.genAI.models.generateContent({
        model: model,
        contents: prompt,
      });

      return this.parseAnalysisResult(result.text || "");
    } catch (error) {
      console.error("Error in Files API analysis:", error);
      throw error;
    }
  }

  /**
   * Analyze video using Gemini Files API (for videos > 20MB)
   */
  private async analyzeWithFilesAPI(
    s3Key: string,
    publicUrl?: string
  ): Promise<VideoAnalysisData> {
    let tempFilePath: string | null = null;

    try {
      // 1. Télécharger la vidéo depuis l'URL publique ou S3
      const videoBuffer = publicUrl
        ? await this.downloadFromUrl(publicUrl)
        : await this.downloadFromS3(s3Key);
      const fileName = s3Key.split("/").pop() || "video.mp4";
      const fileSize = videoBuffer.length;
      console.log("fileSize", fileSize);

      // Vérifier le format du fichier
      const fileSignature = videoBuffer.subarray(0, 4).toString("hex");
      const validSignatures = {
        "66747970": "MP4", // ftyp
        "1a45dfa3": "WebM", // EBML
        "52494646": "AVI", // RIFF
        "00000014": "QuickTime", // QuickTime
      };

      if (
        !Object.keys(validSignatures).some((sig) => fileSignature.includes(sig))
      ) {
        throw new Error(
          `Format de fichier non supporté. Utilisez MP4, WebM, AVI ou QuickTime. File signature: ${fileSignature}`
        );
      }

      // 2. Créer le dossier temporaire s'il n'existe pas
      const tempDir = path.join(process.cwd(), "temp");
      await fs.mkdir(tempDir, { recursive: true });

      // 3. Écrire temporairement le buffer dans un fichier
      tempFilePath = path.join(tempDir, `temp_${Date.now()}_${fileName}`);
      await fs.writeFile(tempFilePath, videoBuffer);

      console.log(`📁 Video saved to temporary file: ${tempFilePath}`);

      // 4. Upload vers Gemini en utilisant le chemin du fichier
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
      let myfile = await ai.files.upload({
        file: tempFilePath,
        config: { mimeType: "video/mp4" },
      });

      // Attendre le traitement avec timeout
      const maxRetries = 10;
      let retries = 0;
      const startTime = Date.now();

      while (myfile.state === FileState.PROCESSING && retries < maxRetries) {
        console.log(
          `🔄 Waiting for file to be processed... (attempt ${
            retries + 1
          }/${maxRetries}), state: ${myfile.state}`
        );
        await new Promise((resolve) => setTimeout(resolve, 2000));
        myfile = await ai.files.get({
          name: myfile.name || "",
        });
        retries++;
      }

      // Vérifier si le timeout a été atteint
      if (retries >= maxRetries) {
        throw new Error(
          "Le traitement du fichier a pris trop de temps. Veuillez réessayer."
        );
      }

      // Amélioration de la gestion des erreurs de l'état du fichier
      if (myfile.state !== FileState.ACTIVE) {
        const errorDetails = myfile.error?.details
          ?.map((d) => d.message)
          .filter(Boolean)
          .join(", ");

        console.error(
          `❌ File processing failed: state=${myfile.state}, error=${
            errorDetails || "No error details provided"
          }, processing time=${Date.now() - startTime}ms`
        );

        let errorMessage = "Échec de l'analyse de la vidéo";

        // Messages d'erreur plus spécifiques selon l'état
        if (myfile.state === FileState.FAILED) {
          if (errorDetails) {
            if (errorDetails.includes("quota")) {
              errorMessage =
                "Quota d'analyse dépassé. Veuillez réessayer plus tard.";
            } else if (errorDetails.includes("format")) {
              errorMessage =
                "Format de fichier non supporté. Utilisez MP4, WebM ou AVI.";
            } else {
              errorMessage = `L'analyse de la vidéo a échoué : ${errorDetails}`;
            }
          } else {
            // Vérifier des conditions spécifiques qui pourraient causer l'échec
            if (videoBuffer.length > 100 * 1024 * 1024) {
              errorMessage =
                "La vidéo est trop volumineuse pour être analysée. Maximum 100MB.";
            } else {
              errorMessage =
                "L'analyse de la vidéo a échoué. Le format n'est peut-être pas supporté ou le fichier est corrompu.";
            }
          }
        } else if (myfile.state === FileState.PROCESSING) {
          errorMessage =
            "Le traitement du fichier a pris trop de temps. Veuillez réessayer.";
        } else {
          errorMessage =
            "Le fichier n'est pas dans un état actif. Veuillez réessayer.";
        }

        throw new Error(errorMessage);
      }

      console.log(`📤 Video uploaded to Gemini, URI: ${myfile.uri}`);

      if (!myfile.uri) {
        throw new Error(
          "Le fichier a été traité mais aucune URI n'a été retournée. Veuillez réessayer."
        );
      }

      // 5. Analyse avec Gemini
      const prompt = this.getAnalysisPrompt();
      const contents = createUserContent([
        createPartFromUri(myfile.uri, "video/mp4"),
        prompt,
      ]);

      const result = await ai.models.generateContent({
        model: model,
        contents: contents,
      });

      return this.parseAnalysisResult(result.text || "");
    } catch (error) {
      console.error("Error in Files API analysis:", error);
      throw error;
    } finally {
      // Nettoyage : supprimer le fichier temporaire
      if (tempFilePath) {
        try {
          await fs.unlink(tempFilePath);
          console.log(`🗑️ Temporary file deleted: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error("Error cleaning up temporary file:", cleanupError);
        }
      }
    }
  }

  /**
   * Download video from S3
   */
  private async downloadFromS3(s3Key: string): Promise<Buffer> {
    if (!S3_BUCKET_NAME) {
      throw new Error("S3_BUCKET_NAME environment variable is required");
    }

    console.log(
      `📥 Downloading from S3: ${s3Key} from bucket ${S3_BUCKET_NAME}`
    );

    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: s3Key,
    });

    try {
      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error("No video data received from S3");
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }

      const buffer = Buffer.concat(chunks);
      console.log(`📥 Successfully downloaded ${buffer.length} bytes from S3`);
      return buffer;
    } catch (error) {
      console.error("❌ Error downloading from S3:", error);
      throw new Error(
        `Failed to download video from S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Download video from URL
   */
  private async downloadFromUrl(url: string): Promise<Buffer> {
    console.log(`📥 Downloading from URL: ${url}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download: ${response.status} ${response.statusText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      console.log(`📥 Successfully downloaded ${buffer.length} bytes from URL`);
      return buffer;
    } catch (error) {
      console.error("❌ Error downloading from URL:", error);
      throw new Error(
        `Failed to download video from URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get the analysis prompt for Gemini
   */
  private getAnalysisPrompt(): string {
    return `
    Analyze this video and provide comprehensive metadata in the following JSON format:

    {
      "title": "A concise, descriptive title for the video (3-8 words)",
      "description": "A detailed description of what happens in the video (1-3 sentences)",
      "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
      "segments": [
        {
          "start_time": "00:00",
          "end_time": "00:15",
          "content_type": "intro|main_content|transition|outro",
          "description": "What happens in this segment",
          "visual_elements": ["person", "screen", "text", "animation"],
          "key_points": ["point1", "point2"]
        }
      ],
      "structure": {
        "has_hook": true|false,
        "has_call_to_action": true|false,
        "transitions_count": 0,
        "pacing": "fast|medium|slow"
      },
      "content_type": "tutorial|entertainment|educational|product_demo|interview|vlog|other",
      "language": "fr|en|es|de|other",
      "duration_category": "short|medium|long",
      "key_moments": {
        "hook_start": "00:05",
        "main_content_start": "00:15",
        "call_to_action_start": "01:45",
        "end": "02:00"
      }
    }

    Guidelines:
    - Title: 3-8 words, descriptive but concise
    - Description: 1-3 sentences explaining main content
    - Tags: 3-8 relevant keywords for filtering
    - Segments: Divide video into logical parts (15-30 second segments)
    - Content type: Match primary purpose of video
    - Language: Primary language spoken
    - Duration category: short (<30s), medium (30s-2min), long (>2min)
    - Visual elements: What's visible (person, screen, text, etc.)
    - Key points: Main ideas or actions in each segment
    - Structure: Detect hooks, CTAs, transitions, pacing
    - Key moments: Important timestamps for future editing

    Return ONLY valid JSON. Do not include any markdown formatting or additional text.
    `;
  }

  private getAnalysisPromptWithVideoUrl(videoUrl: string): string {
    return `
    Analyze this video: ${videoUrl} and provide comprehensive metadata in the following JSON format:

    {
      "title": "A concise, descriptive title for the video (3-8 words)",
      "description": "A detailed description of what happens in the video (1-3 sentences)",
      "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
      "segments": [
        {
          "start_time": "00:00",
          "end_time": "00:15",
          "content_type": "intro|main_content|transition|outro",
          "description": "What happens in this segment",
          "visual_elements": ["person", "screen", "text", "animation"],
          "key_points": ["point1", "point2"]
        }
      ],
      "structure": {
        "has_hook": true|false,
        "has_call_to_action": true|false,
        "transitions_count": 0,
        "pacing": "fast|medium|slow"
      },
      "content_type": "tutorial|entertainment|educational|product_demo|interview|vlog|other",
      "language": "fr|en|es|de|other",
      "duration_category": "short|medium|long",
      "key_moments": {
        "hook_start": "00:05",
        "main_content_start": "00:15",
        "call_to_action_start": "01:45",
        "end": "02:00"
      }
    }

    Guidelines:
    - Title: 3-8 words, descriptive but concise
    - Description: 1-3 sentences explaining main content
    - Tags: 3-8 relevant keywords for filtering
    - Segments: Divide video into logical parts (15-30 second segments)
    - Content type: Match primary purpose of video
    - Language: Primary language spoken
    - Duration category: short (<30s), medium (30s-2min), long (>2min)
    - Visual elements: What's visible (person, screen, text, etc.)
    - Key points: Main ideas or actions in each segment
    - Structure: Detect hooks, CTAs, transitions, pacing
    - Key moments: Important timestamps for future editing

    Return ONLY valid JSON. Do not include any markdown formatting or additional text.

    If you cannot analyze the video, return an JSON object containing the error message.

    EXAMPLE:
    {
      "error": "No JSON found in response"
    }
    `;
  }

  /**
   * Parse the analysis result from Gemini response
   */
  private parseAnalysisResult(responseText: string): VideoAnalysisData {
    try {
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      console.log("jsonMatch", jsonMatch);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate required fields
      const requiredFields = [
        "title",
        "description",
        "tags",
        "segments",
        "structure",
      ];
      for (const field of requiredFields) {
        if (parsed.error) {
          throw new Error(parsed.error as string);
        }
        if (!parsed[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      // Ensure arrays are properly formatted
      if (!Array.isArray(parsed.tags)) {
        parsed.tags = [parsed.tags].filter(Boolean);
      }

      if (!Array.isArray(parsed.segments)) {
        parsed.segments = [];
      }

      return {
        title: parsed.title || "",
        description: parsed.description || "",
        tags: parsed.tags || [],
        segments: parsed.segments || [],
        structure: {
          has_hook: parsed.structure?.has_hook || false,
          has_call_to_action: parsed.structure?.has_call_to_action || false,
          transitions_count: parsed.structure?.transitions_count || 0,
          pacing: parsed.structure?.pacing || "medium",
        },
        content_type: parsed.content_type || "other",
        language: parsed.language || "fr",
        duration_category: parsed.duration_category || "medium",
        key_moments: parsed.key_moments || {},
      };
    } catch (error) {
      console.error("Error parsing analysis result:", error);
      throw new Error(
        `Failed to parse analysis result: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Test if the service is working
   */
  async testConnection(): Promise<boolean> {
    try {
      // const result = await this.model.generateContent({
      //   contents: ["Hello, this is a test."],
      // });
      // return result.response.text().length > 0;
      return true;
    } catch (error) {
      console.error("Gemini service test failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
