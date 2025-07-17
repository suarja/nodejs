import express from "express";
import multer from "multer";
import { Readable } from "stream";
import { ClerkAuthService } from "../../services/clerkAuthService";
import { supabase } from "../../config/supabase";
import { ElevenLabsClient, stream } from "@elevenlabs/elevenlabs-js";
import {
  usageLimiter,
  incrementResourceUsage,
} from "../../middleware/usageLimitMiddleware";
import { ResourceType } from "../../types/ressource";
import { logger } from "../../config/logger";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
});

const router = express.Router();

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error("❌ ELEVENLABS_API_KEY not found in environment variables");
}
const voiceLogger = logger.child({
  module: "voiceClone",
});
// Initialize ElevenLabs client
const elevenLabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

/**
 * Create voice clone endpoint
 * POST /api/voice-clone
 */
router.post(
  "/",
  upload.array("files", 10),
  usageLimiter(ResourceType.VOICE_CLONES),
  async (req: any, res) => {
    const requestId = `voice-clone-${Date.now()}`;

    try {
      voiceLogger.info(`🎤 Voice clone request started: ${requestId}`);

      // User is already authenticated by the usageLimiter middleware
      const { user } = req;
      voiceLogger.info(`✅ User authenticated: ${user.email} (${user.id})`);

      // Step 2: Validate input
      const { name } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!name || typeof name !== "string" || name.trim().length === 0) {
        voiceLogger.error(`❌ Invalid name for request ${requestId}:`, name);
        return res.status(400).json({
          success: false,
          error: "Name is required and must be a non-empty string",
          requestId,
        });
      }

      if (!files || files.length === 0) {
        voiceLogger.error(`❌ No files provided for request ${requestId}`);
        return res.status(400).json({
          success: false,
          error: "At least one audio file is required",
          requestId,
        });
      }

      voiceLogger.info(`📁 Files received: ${files.length} files`);

      // Validate each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) {
          voiceLogger.error(`❌ File ${i + 1} is undefined`);
          return res.status(400).json({
            success: false,
            error: `File ${i + 1} is missing or invalid`,
            requestId,
          });
        }

        voiceLogger.info(
          `📄 File ${i + 1}: ${file.originalname}, size: ${file.size}, type: ${
            file.mimetype
          }`
        );

        // Check for empty files
        if (file.size === 0) {
          voiceLogger.error(`❌ File ${i + 1} is empty: ${file.originalname}`);
          return res.status(400).json({
            success: false,
            error: `File "${file.originalname}" is empty. Please record a valid audio file.`,
            requestId,
          });
        }

        // Check minimum size (at least 1KB for a meaningful audio file)
        if (file.size < 1000) {
          voiceLogger.error(
            `❌ File ${i + 1} too small: ${file.originalname} (${
              file.size
            } bytes)`
          );
          return res.status(400).json({
            success: false,
            error: `File "${file.originalname}" is too small (${file.size} bytes). Please record at least 3 seconds of audio.`,
            requestId,
          });
        }

        // Check maximum size (10MB)
        if (file.size > 30 * 1024 * 1024) {
          voiceLogger.error(
            `❌ File ${i + 1} too large: ${file.originalname} (${(
              file.size /
              1024 /
              1024
            ).toFixed(1)}MB)`
          );
          return res.status(400).json({
            success: false,
            error: `File "${file.originalname}" is too large (${(
              file.size /
              1024 /
              1024
            ).toFixed(1)}MB). Maximum size is 30MB.`,
            requestId,
          });
        }
      }

      // Step 3: Test ElevenLabs API connectivity
      voiceLogger.info(`🔍 Testing ElevenLabs API connectivity...`);

      try {
        // Test API by listing voices (simple test)
        await elevenLabs.voices.getAll();
        voiceLogger.info(`✅ ElevenLabs API test successful`);
      } catch (testError: any) {
        voiceLogger.error(`❌ ElevenLabs API test error:`, testError.message);
        return res.status(502).json({
          success: false,
          error: `Cannot connect to ElevenLabs: ${testError.message}`,
          requestId,
        });
      }

      // Step 4: Upload to ElevenLabs using SDK
      voiceLogger.info(`🚀 Starting ElevenLabs upload process...`);

      try {
        // Prepare files for ElevenLabs SDK
        voiceLogger.info(
          `📤 Preparing ${files.length} files for ElevenLabs...`
        );

        files.forEach((file, index) => {
          const fileName = file.originalname || `recording-${index + 1}.m4a`;
          voiceLogger.info(
            `📄 File ${index + 1}: ${fileName}, size: ${file.size}, type: ${
              file.mimetype
            }`
          );
        });

        // Create voice clone using official ElevenLabs SDK
        voiceLogger.info(
          `📡 Calling ElevenLabs IVC create with ${files.length} files...`
        );

        const elevenlabsResult = await elevenLabs.voices.ivc.create({
          files: files.map((file: any, index: number) => {
            const stream = Readable.from(file.buffer);
            (stream as any).name = file.originalname;
            return stream;
          }) as any,
          name: name.trim(),
        });

        voiceLogger.info(
          `✅ ElevenLabs upload successful, voice_id: ${elevenlabsResult.voiceId}`
        );

        if (!elevenlabsResult.voiceId) {
          voiceLogger.error(`❌ ElevenLabs upload failed:`, elevenlabsResult);
          return res.status(502).json({
            success: false,
            error: `ElevenLabs error: ${elevenlabsResult}`,
            requestId,
          });
        }

        // Step 5: Save to database and increment usage
        voiceLogger.info(`💾 Saving to database...`);

        // Get existing voice clone if any
        const { data: existingVoiceClone } = await supabase
          .from("voice_clones")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingVoiceClone) {
          // Update existing record
          const { error } = await supabase
            .from("voice_clones")
            .update({
              elevenlabs_voice_id: elevenlabsResult.voiceId,
              status: "ready",
              sample_files: files.map((f) => f.originalname),
              name: name.trim(),
            })
            .eq("id", existingVoiceClone.id);

          if (error) throw error;
        } else {
          // Create new record and increment usage
          const { error } = await supabase.from("voice_clones").insert({
            user_id: user.id,
            elevenlabs_voice_id: elevenlabsResult.voiceId,
            status: "ready",
            sample_files: files.map((f) => f.originalname),
            name: name.trim(),
          });

          if (error) throw error;

          // Increment usage only on successful creation of a *new* clone
          await incrementResourceUsage(user.id, ResourceType.VOICE_CLONES);
        }

        voiceLogger.info(
          `✅ Voice clone saved to database for user ${user.id}`
        );

        // Step 6: Send response
        return res.status(201).json({
          success: true,
          voice_id: elevenlabsResult.voiceId,
          message: "Voice clone created successfully",
          requestId,
        });
      } catch (elevenLabsError: any) {
        voiceLogger.error(`❌ ElevenLabs SDK error:`, elevenLabsError);
        return res.status(502).json({
          success: false,
          error: `ElevenLabs error: ${elevenLabsError.message}`,
          requestId,
        });
      }
    } catch (error: any) {
      voiceLogger.error(`❌ Voice clone request failed:`, error);

      // Determine appropriate status code
      let statusCode = 500;
      if (error.message?.includes("Invalid input")) {
        statusCode = 400;
      } else if (error.message?.includes("ElevenLabs")) {
        statusCode = 502;
      }

      return res.status(statusCode).json({
        success: false,
        error: error.message || "Internal server error",
        requestId,
      });
    }
  }
);

/**
 * Get voice samples endpoint
 * GET /api/voice-clone/samples/:voiceId
 */
router.get("/samples/:voiceId", async (req, res) => {
  const requestId = `voice-samples-${Date.now()}`;

  try {
    voiceLogger.info(`🔍 Voice samples request started: ${requestId}`);

    // Step 1: Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } =
      await ClerkAuthService.verifyUser(authHeader);

    if (authError || !user) {
      voiceLogger.error(`❌ Auth failed for request ${requestId}:`, authError);
      return res.status(authError.status).json(authError);
    }

    const { voiceId } = req.params;

    if (!voiceId) {
      return res.status(400).json({
        success: false,
        error: "Voice ID is required",
        requestId,
      });
    }

    // Step 2: Verify this voice belongs to the user
    const { data: voiceClone } = await supabase
      .from("voice_clones")
      .select("*")
      .eq("user_id", user.id)
      .eq("elevenlabs_voice_id", voiceId)
      .single();

    if (!voiceClone) {
      return res.status(404).json({
        success: false,
        error: "Voice not found or access denied",
        requestId,
      });
    }

    // Step 3: Get voice details from ElevenLabs
    voiceLogger.info(`📡 Fetching voice details from ElevenLabs: ${voiceId}`);

    try {
      const voice = await elevenLabs.voices.get(voiceId);

      voiceLogger.info(
        `✅ Voice details retrieved: ${voice.samples?.length || 0} samples`
      );
      voiceLogger.info(
        `🔍 DEBUG samples structure:`,
        JSON.stringify(voice.samples, null, 2)
      );

      return res.status(200).json({
        success: true,
        samples: voice.samples || [],
        requestId,
      });
    } catch (elevenLabsError: any) {
      voiceLogger.error(`❌ ElevenLabs API error:`, elevenLabsError.message);
      return res.status(502).json({
        success: false,
        error: `ElevenLabs error: ${elevenLabsError.message}`,
        requestId,
      });
    }
  } catch (error: any) {
    voiceLogger.error(`❌ Voice samples request failed:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      requestId,
    });
  }
});

/**
 * Get temporary audio URL endpoint
 * POST /api/voice-clone/samples/:voiceId/:sampleId/audio-url
 */
router.post("/samples/:voiceId/:sampleId/audio-url", async (req, res) => {
  const requestId = `voice-audio-url-${Date.now()}`;

  try {
    voiceLogger.info(`🔊 Voice audio URL request started: ${requestId}`);

    // Step 1: Authenticate user (proper header auth)
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } =
      await ClerkAuthService.verifyUser(authHeader);

    if (authError || !user) {
      voiceLogger.error(`❌ Auth failed for request ${requestId}:`, authError);
      return res.status(authError.status).json(authError);
    }

    const { voiceId, sampleId } = req.params;

    if (!voiceId || !sampleId) {
      return res.status(400).json({
        success: false,
        error: "Voice ID and Sample ID are required",
        requestId,
      });
    }

    // Step 2: Verify this voice belongs to the user
    const { data: voiceClone } = await supabase
      .from("voice_clones")
      .select("*")
      .eq("user_id", user.id)
      .eq("elevenlabs_voice_id", voiceId)
      .single();

    if (!voiceClone) {
      return res.status(404).json({
        success: false,
        error: "Voice not found or access denied",
        requestId,
      });
    }

    // Step 3: Generate temporary access token (valid for 5 minutes)
    const tempToken = Buffer.from(
      JSON.stringify({
        userId: user.id,
        voiceId,
        sampleId,
        expires: Date.now() + 5 * 60 * 1000, // 5 minutes
      })
    ).toString("base64");

    // Return the URL with temp token
    const audioUrl = `${req.protocol}://${req.get(
      "host"
    )}/api/voice-clone/samples/${voiceId}/${sampleId}/audio?temp=${tempToken}`;

    voiceLogger.info(`✅ Generated temporary audio URL for ${sampleId}`);

    return res.status(200).json({
      success: true,
      audioUrl,
      expiresIn: 300, // 5 minutes
      requestId,
    });
  } catch (error: any) {
    voiceLogger.error(`❌ Voice audio URL request failed:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      requestId,
    });
  }
});

/**
 * Get voice sample audio endpoint (with temporary token)
 * GET /api/voice-clone/samples/:voiceId/:sampleId/audio
 */
router.get("/samples/:voiceId/:sampleId/audio", async (req, res) => {
  const requestId = `voice-sample-audio-${Date.now()}`;

  try {
    voiceLogger.info(`🔊 Voice sample audio request started: ${requestId}`);

    const { voiceId, sampleId } = req.params;
    const tempToken = req.query.temp as string;

    if (!voiceId || !sampleId) {
      return res.status(400).json({
        success: false,
        error: "Voice ID and Sample ID are required",
        requestId,
      });
    }

    // Step 1: Validate temporary token
    if (!tempToken) {
      return res.status(401).json({
        success: false,
        error: "Temporary token required",
        requestId,
      });
    }

    let tokenData;
    try {
      //! TODO: Check if this is secure
      tokenData = JSON.parse(Buffer.from(tempToken, "base64").toString());
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: "Invalid temporary token",
        requestId,
      });
    }

    // Check token expiration
    if (Date.now() > tokenData.expires) {
      return res.status(401).json({
        success: false,
        error: "Temporary token expired",
        requestId,
      });
    }

    // Verify token matches request
    if (tokenData.voiceId !== voiceId || tokenData.sampleId !== sampleId) {
      return res.status(401).json({
        success: false,
        error: "Token does not match request",
        requestId,
      });
    }

    // Step 2: Stream audio from ElevenLabs
    const elevenLabsAudioUrl = `https://api.elevenlabs.io/v1/voices/${voiceId}/samples/${sampleId}/audio`;

    voiceLogger.info(`🔄 Streaming ElevenLabs audio: ${voiceId}/${sampleId}`);

    try {
      const elevenLabsResponse = await fetch(elevenLabsAudioUrl, {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY!,
        },
      });

      if (!elevenLabsResponse.ok) {
        throw new Error(
          `ElevenLabs responded with ${elevenLabsResponse.status}`
        );
      }

      // Stream the audio directly
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="sample_${sampleId}.mp3"`
      );

      // Convert ReadableStream to Buffer for Node.js compatibility
      const arrayBuffer = await elevenLabsResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (elevenLabsError: any) {
      voiceLogger.error(`❌ ElevenLabs audio error:`, elevenLabsError.message);
      return res.status(502).json({
        success: false,
        error: `ElevenLabs audio error: ${elevenLabsError.message}`,
        requestId,
      });
    }
  } catch (error: any) {
    voiceLogger.error(`❌ Voice sample audio request failed:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      requestId,
    });
  }
});

router.get("/user-voices", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { user, errorResponse } = await ClerkAuthService.verifyUser(
      authHeader
    );

    if (errorResponse || !user) {
      return res.status(errorResponse.status).json(errorResponse);
    }
    const { data, error } = await supabase
      .from("voice_clones")
      .select("*")
      .eq("user_id", user.id);

    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
