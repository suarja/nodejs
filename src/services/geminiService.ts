import { GoogleGenerativeAI } from "@google/generative-ai";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../config/aws";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  method_used?: "files" | "inline";
}

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable is required");
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  }

  /**
   * Analyze a video from S3 using Gemini AI
   */
  async analyzeVideoFromS3(
    s3Key: string,
    fileName: string,
    fileSize: number
  ): Promise<GeminiAnalysisResponse> {
    const startTime = Date.now();

    try {
      console.log(
        `🧠 Starting video analysis for: ${s3Key} (${fileSize} bytes)`
      );

      // Determine upload method based on file size
      const useFilesAPI = fileSize > 20 * 1024 * 1024; // > 20MB
      const method = useFilesAPI ? "files" : "inline";

      console.log(`📤 Using ${method} method for video analysis (no timeout)`);

      let analysisResult: VideoAnalysisData;

      if (useFilesAPI) {
        analysisResult = await this.analyzeWithFilesAPI(s3Key);
      } else {
        analysisResult = await this.analyzeWithInlineData(s3Key);
      }

      const analysisTime = Date.now() - startTime;

      console.log(`✅ Video analysis completed in ${analysisTime}ms`);

      return {
        success: true,
        data: analysisResult,
        analysis_time: analysisTime,
        method_used: method,
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
   * Analyze video using Gemini Files API (for videos > 20MB)
   */
  private async analyzeWithFilesAPI(s3Key: string): Promise<VideoAnalysisData> {
    try {
      // Get presigned URL for S3 file
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: s3Key,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600, // 1 hour
      });

      // Use file URL directly with Gemini
      const fileData = {
        fileData: {
          fileUri: presignedUrl,
        },
      };

      // Analyze with Gemini
      const prompt = this.getAnalysisPrompt();
      const result = await this.model.generateContent([prompt, fileData]);

      return this.parseAnalysisResult(result.response.text());
    } catch (error) {
      console.error("Error in Files API analysis:", error);
      throw new Error(
        `Files API analysis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Analyze video using inline data (for videos < 20MB)
   */
  private async analyzeWithInlineData(
    s3Key: string
  ): Promise<VideoAnalysisData> {
    try {
      // Download video from S3
      const videoBuffer = await this.downloadFromS3(s3Key);

      // Analyze with Gemini using inline data
      const prompt = this.getAnalysisPrompt();
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: "video/mp4",
            data: videoBuffer.toString("base64"),
          },
        },
      ]);

      return this.parseAnalysisResult(result.response.text());
    } catch (error) {
      console.error("Error in inline analysis:", error);
      throw new Error(
        `Inline analysis failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Download video from S3
   */
  private async downloadFromS3(s3Key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
    });

    const response = await s3Client.send(command);

    if (!response.Body) {
      throw new Error("No video data received from S3");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
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

  /**
   * Parse the analysis result from Gemini response
   */
  private parseAnalysisResult(responseText: string): VideoAnalysisData {
    try {
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
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
      const result = await this.model.generateContent("Hello, this is a test.");
      return result.response.text().length > 0;
    } catch (error) {
      console.error("Gemini service test failed:", error);
      return false;
    }
  }
}

// Export singleton instance
export const geminiService = new GeminiService();
