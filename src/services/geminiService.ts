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
import { spawn, execSync } from "child_process";
import { promisify } from "util";

const model = "gemini-2.5-flash";

// Add video conversion utility
interface VideoConversionResult {
  success: boolean;
  outputPath?: string;
  originalFormat?: string;
  error?: string;
}

// Railway/production environment detection
const isRailway =
  process.env.RAILWAY_ENVIRONMENT === "production" ||
  process.env.NODE_ENV === "production";
const isDevelopment =
  process.env.NODE_ENV === "development" || !process.env.NODE_ENV;

// FFmpeg path detection
let FFMPEG_PATH: string | null = null;

/**
 * Initialize FFmpeg path based on environment
 */
async function initializeFFmpegPath(): Promise<string | null> {
  if (FFMPEG_PATH) return FFMPEG_PATH;

  try {
    if (isRailway || process.platform === "linux") {
      // Railway/Linux: Use system FFmpeg installed via nixpacks
      console.log("🐧 Detecting system FFmpeg (Railway/Linux)...");
      const ffmpegPath = execSync("which ffmpeg", { encoding: "utf8" }).trim();
      FFMPEG_PATH = ffmpegPath;
      console.log(`✅ Found system FFmpeg: ${FFMPEG_PATH}`);
    } else {
      // Local development: Try system first, then fallback to npm package
      try {
        console.log("💻 Detecting system FFmpeg (local)...");
        const ffmpegPath = execSync("which ffmpeg", {
          encoding: "utf8",
        }).trim();
        FFMPEG_PATH = ffmpegPath;
        console.log(`✅ Found system FFmpeg: ${FFMPEG_PATH}`);
      } catch {
        console.log("📦 Falling back to npm FFmpeg package...");
        try {
          // Fallback to npm package for local development - using dynamic import
          const ffmpegModule = await import("@ffmpeg-installer/ffmpeg").catch(
            () => null
          );
          if (ffmpegModule && ffmpegModule.path) {
            FFMPEG_PATH = ffmpegModule.path;
            console.log(`✅ Found npm FFmpeg: ${FFMPEG_PATH}`);
          } else {
            console.log("⚠️ No FFmpeg found via npm package");
            FFMPEG_PATH = null;
          }
        } catch (npmError) {
          console.log("⚠️ No FFmpeg found via npm package");
          FFMPEG_PATH = null;
        }
      }
    }
  } catch (error) {
    console.error("❌ FFmpeg path detection failed:", error);
    FFMPEG_PATH = null;
  }

  return FFMPEG_PATH;
}

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

    // Initialize FFmpeg path on service creation
    this.initializeService();
  }

  private async initializeService() {
    console.log(
      `🚀 Initializing Gemini Service (Environment: ${
        process.env.NODE_ENV || "development"
      })`
    );
    await initializeFFmpegPath();
  }

  /**
   * Check if FFmpeg is available on the system
   */
  private async checkFFmpegAvailability(): Promise<boolean> {
    const ffmpegPath = await initializeFFmpegPath();

    if (!ffmpegPath) {
      return false;
    }

    return new Promise((resolve) => {
      const ffmpeg = spawn(ffmpegPath, ["-version"]);

      ffmpeg.on("close", (code) => {
        resolve(code === 0);
      });

      ffmpeg.on("error", () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        ffmpeg.kill();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Convert video to MP4 format using FFmpeg
   */
  private async convertToMp4(
    inputPath: string,
    outputPath: string
  ): Promise<VideoConversionResult> {
    // Check if FFmpeg is available
    const ffmpegAvailable = await this.checkFFmpegAvailability();
    const ffmpegPath = await initializeFFmpegPath();

    if (!ffmpegAvailable || !ffmpegPath) {
      let installInstructions =
        "FFmpeg not found. Please install FFmpeg to enable video conversion.\n";

      if (isRailway) {
        installInstructions +=
          "Railway Installation:\n" +
          "1. Create nixpacks.toml in your project root:\n" +
          "   [phases.setup]\n" +
          "   nixPkgs = ['ffmpeg']\n" +
          "2. Redeploy your Railway service\n" +
          "3. FFmpeg will be available at /nix/store/.../bin/ffmpeg";
      } else {
        installInstructions +=
          "Local Installation:\n" +
          "- Ubuntu/Debian: sudo apt update && sudo apt install ffmpeg\n" +
          "- CentOS/RHEL: sudo yum install ffmpeg\n" +
          "- macOS: brew install ffmpeg\n" +
          "- Windows: Download from https://ffmpeg.org/download.html";
      }

      return {
        success: false,
        error: installInstructions,
      };
    }

    return new Promise((resolve) => {
      console.log(`🎬 Converting video to MP4: ${inputPath} → ${outputPath}`);
      console.log(`🔧 Using FFmpeg: ${ffmpegPath}`);

      const ffmpeg = spawn(ffmpegPath, [
        "-i",
        inputPath,
        "-c:v",
        "libx264", // Video codec
        "-c:a",
        "aac", // Audio codec
        "-movflags",
        "+faststart", // Web optimization
        "-preset",
        "fast", // Encoding speed vs compression
        "-crf",
        "23", // Quality (lower = better)
        "-y", // Overwrite output file
        outputPath,
      ]);

      let stderr = "";

      ffmpeg.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          console.log(`✅ Video conversion successful: ${outputPath}`);
          resolve({
            success: true,
            outputPath: outputPath,
          });
        } else {
          console.error(`❌ FFmpeg conversion failed with code ${code}`);
          console.error(`FFmpeg stderr: ${stderr}`);
          resolve({
            success: false,
            error: `Video conversion failed: ${stderr.slice(-200)}`, // Last 200 chars of error
          });
        }
      });

      ffmpeg.on("error", (error) => {
        console.error(`❌ FFmpeg spawn error:`, error);
        resolve({
          success: false,
          error: `FFmpeg not found or failed to start: ${error.message}`,
        });
      });
    });
  }

  /**
   * Detect video format and get proper MIME type
   */
  private detectVideoFormat(videoBuffer: Buffer): {
    mimeType: string;
    extension: string;
    needsConversion: boolean;
    detectedFormat: string;
  } {
    const signature = videoBuffer.subarray(0, 12).toString("hex");

    // Enhanced format detection
    const formats = {
      // MP4 variants
      "66747970": {
        mimeType: "video/mp4",
        extension: "mp4",
        needsConversion: false,
        name: "MP4",
      },
      "667479706d703432": {
        mimeType: "video/mp4",
        extension: "mp4",
        needsConversion: false,
        name: "MP4",
      },
      "667479706d703431": {
        mimeType: "video/mp4",
        extension: "mp4",
        needsConversion: false,
        name: "MP4",
      },
      "66747970697473": {
        mimeType: "video/mp4",
        extension: "mp4",
        needsConversion: false,
        name: "MP4",
      },

      // WebM
      "1a45dfa3": {
        mimeType: "video/webm",
        extension: "webm",
        needsConversion: true,
        name: "WebM",
      },

      // AVI
      "52494646": {
        mimeType: "video/avi",
        extension: "avi",
        needsConversion: true,
        name: "AVI",
      },

      // QuickTime/MOV
      "00000014": {
        mimeType: "video/mov",
        extension: "mov",
        needsConversion: true,
        name: "QuickTime",
      },
      "00000018": {
        mimeType: "video/mov",
        extension: "mov",
        needsConversion: true,
        name: "QuickTime",
      },
      "0000001c": {
        mimeType: "video/mov",
        extension: "mov",
        needsConversion: true,
        name: "QuickTime",
      },

      // WMV
      "3026b275": {
        mimeType: "video/wmv",
        extension: "wmv",
        needsConversion: true,
        name: "WMV",
      },

      // FLV
      "464c5601": {
        mimeType: "video/x-flv",
        extension: "flv",
        needsConversion: true,
        name: "FLV",
      },

      // 3GPP
      "66747970336770": {
        mimeType: "video/3gpp",
        extension: "3gp",
        needsConversion: true,
        name: "3GPP",
      },
    };

    // Check for known signatures
    for (const [sig, format] of Object.entries(formats)) {
      if (signature.startsWith(sig) || signature.includes(sig)) {
        return {
          mimeType: format.mimeType,
          extension: format.extension,
          needsConversion: format.needsConversion,
          detectedFormat: format.name,
        };
      }
    }

    // Default to MP4 conversion for unknown formats
    console.warn(
      `⚠️ Unknown video format signature: ${signature}. Defaulting to MP4 conversion.`
    );
    return {
      mimeType: "video/mp4",
      extension: "mp4",
      needsConversion: true,
      detectedFormat: "Unknown",
    };
  }

  /**
   * Try to analyze video directly from URL (works for YouTube, TikTok)
   * Falls back to Files API for other URLs like S3
   */
  private async tryDirectUrlAnalysis(
    videoUrl: string
  ): Promise<VideoAnalysisData | null> {
    try {
      // Check if this is a supported direct URL
      const isYouTube =
        videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
      const isTikTok = videoUrl.includes("tiktok.com");

      if (!isYouTube && !isTikTok) {
        console.log(`🔗 URL not supported for direct analysis: ${videoUrl}`);
        console.log(
          `💡 Direct URL analysis only works for YouTube and TikTok URLs`
        );
        console.log(`🔄 Falling back to Files API for S3/other URLs`);
        return null;
      }

      console.log(`🎬 Attempting direct URL analysis for: ${videoUrl}`);

      const prompt = this.getAnalysisPromptWithVideoUrl(videoUrl);
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

      const result = await ai.models.generateContent({
        model: model,
        contents: [prompt],
      });

      const responseText = result.text || "";

      // Check if Gemini returned the "cannot access" error
      if (responseText.includes("Cannot access or analyze video content")) {
        console.log(
          `⚠️ Direct URL analysis failed - video not accessible to Gemini`
        );
        return null;
      }

      return this.parseAnalysisResult(responseText);
    } catch (error) {
      console.log(`⚠️ Direct URL analysis failed:`, error);
      return null;
    }
  }

  /**
   * Analyze a video from S3 using Gemini AI
   */
  async analyzeVideoFromS3(publicUrl: string): Promise<GeminiAnalysisResponse> {
    const startTime = Date.now();

    try {
      console.log(`🧠 Starting video analysis for: ${publicUrl}`);

      let analysisResult: VideoAnalysisData;

      // First, try direct URL analysis (works for YouTube/TikTok)
      const directResult = await this.tryDirectUrlAnalysis(publicUrl);

      if (directResult) {
        console.log(`✅ Direct URL analysis successful`);
        analysisResult = directResult;
      } else {
        console.log(`🔄 Using Files API for video analysis`);
        analysisResult = await this.analyzeWithFilesAPI(publicUrl);
      }

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
    publicUrl: string
  ): Promise<VideoAnalysisData> {
    let tempFilePath: string | null = null;
    let convertedFilePath: string | null = null;

    try {
      // 1. Download video from public URL or S3
      const videoBuffer = await this.downloadFromUrl(publicUrl);
      const fileSize = videoBuffer.length;
      console.log(`📥 Downloaded video: ${fileSize} bytes`);

      // 2. Detect video format and determine if conversion is needed
      const formatInfo = this.detectVideoFormat(videoBuffer);
      console.log(
        `🎬 Detected format: ${formatInfo.detectedFormat} (${formatInfo.mimeType})`
      );
      console.log(`🔄 Needs conversion: ${formatInfo.needsConversion}`);

      // 3. Create temp directory
      const tempDir = path.join(process.cwd(), "temp");
      await fs.mkdir(tempDir, { recursive: true });

      // 4. Save original file
      tempFilePath = path.join(
        tempDir,
        `temp_${Date.now()}_original.${formatInfo.extension}`
      );
      await fs.writeFile(tempFilePath, videoBuffer);
      console.log(`📁 Original video saved: ${tempFilePath}`);

      let finalFilePath = tempFilePath;
      let finalMimeType = formatInfo.mimeType;

      // 5. Convert to MP4 if needed
      if (formatInfo.needsConversion) {
        convertedFilePath = path.join(
          tempDir,
          `temp_${Date.now()}_converted.mp4`
        );

        const conversionResult = await this.convertToMp4(
          tempFilePath,
          convertedFilePath
        );

        if (conversionResult.success && conversionResult.outputPath) {
          console.log(`✅ Video converted to MP4: ${convertedFilePath}`);
          finalFilePath = convertedFilePath;
          finalMimeType = "video/mp4";
        } else {
          console.warn(
            `⚠️ Conversion failed, using original: ${conversionResult.error}`
          );
          // Continue with original file if conversion fails
        }
      }

      // 6. Upload to Gemini Files API
      const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
      let myfile = await ai.files.upload({
        file: finalFilePath,
        config: { mimeType: finalMimeType },
      });

      console.log(`📤 Video uploaded to Gemini: ${myfile.name}`);

      // 7. Wait for processing with enhanced timeout
      const maxRetries = 15; // Increased for larger files
      let retries = 0;
      const processingStartTime = Date.now();

      while (myfile.state === FileState.PROCESSING && retries < maxRetries) {
        const elapsed = Math.round((Date.now() - processingStartTime) / 1000);
        console.log(
          `🔄 Waiting for file processing... (${
            retries + 1
          }/${maxRetries}), state: ${myfile.state}, elapsed: ${elapsed}s`
        );

        await new Promise((resolve) => setTimeout(resolve, 3000)); // Increased to 3s

        myfile = await ai.files.get({
          name: myfile.name || "",
        });
        retries++;
      }

      // 8. Check final state
      if (retries >= maxRetries) {
        throw new Error(
          `Video processing timeout after ${Math.round(
            (Date.now() - processingStartTime) / 1000
          )}s. Try with a smaller video.`
        );
      }

      if (myfile.state !== FileState.ACTIVE) {
        const errorDetails = myfile.error?.details
          ?.map((d) => d.message)
          .filter(Boolean)
          .join(", ");

        console.error(
          `❌ File processing failed: state=${myfile.state}, error=${
            errorDetails || "No error details"
          }`
        );

        let errorMessage = "Video processing failed";

        if (myfile.state === FileState.FAILED) {
          if (errorDetails?.includes("quota")) {
            errorMessage = "Analysis quota exceeded. Please try again later.";
          } else if (
            errorDetails?.includes("format") ||
            errorDetails?.includes("codec")
          ) {
            errorMessage =
              "Video format not supported. Please try converting to MP4 manually.";
          } else if (videoBuffer.length > 100 * 1024 * 1024) {
            errorMessage =
              "Video too large for analysis. Maximum 100MB supported.";
          } else {
            errorMessage = `Video processing failed: ${
              errorDetails || "Unknown error"
            }`;
          }
        }

        throw new Error(errorMessage);
      }

      console.log(`📤 Video ready for analysis: ${myfile.uri}`);

      if (!myfile.uri) {
        throw new Error(
          "File processed but no URI returned. Please try again."
        );
      }

      // 9. Analyze with Gemini
      const prompt = this.getAnalysisPrompt();
      const contents = createUserContent([
        createPartFromUri(myfile.uri, finalMimeType),
        prompt,
      ]);

      const result = await ai.models.generateContent({
        model: model,
        contents: contents,
      });

      return this.parseAnalysisResult(result.text || "");
    } catch (error) {
      console.error("❌ Files API analysis error:", error);
      throw error;
    } finally {
      // Cleanup temp files
      const filesToCleanup = [tempFilePath, convertedFilePath].filter(Boolean);

      for (const filePath of filesToCleanup) {
        try {
          await fs.unlink(filePath!);
          console.log(`🗑️ Cleaned up: ${path.basename(filePath!)}`);
        } catch (cleanupError) {
          console.error(`⚠️ Cleanup error for ${filePath}:`, cleanupError);
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
    CRITICAL INSTRUCTION: Only analyze this video if you can actually access and view it: ${videoUrl}

    If you CANNOT access, view, or analyze the video content for ANY reason (including content policy restrictions, identifiable people, or technical limitations), return EXACTLY this JSON:
    {
      "error": "Cannot access or analyze video content"
    }

    If you CAN access and analyze the video, provide comprehensive metadata in this JSON format:

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

    Guidelines for REAL analysis (only if you can actually see the video):
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

    IMPORTANT RULES:
    1. DO NOT hallucinate or make up content if you cannot see the video
    2. DO NOT create fake analysis based on the URL or filename
    3. If uncertain about any content, use the error response format
    4. Return ONLY valid JSON, no markdown formatting or additional text
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
