import express from "express";
import multer from "multer";
import { Readable } from "stream";
import { AuthService } from "../../services/authService";
import { supabase } from "../../config/supabase";
import { ElevenLabsClient, stream } from "@elevenlabs/elevenlabs-js";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const router = express.Router();

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!ELEVENLABS_API_KEY) {
  console.error("❌ ELEVENLABS_API_KEY not found in environment variables");
}

// Initialize ElevenLabs client
const elevenLabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

/**
 * Create voice clone endpoint
 * POST /api/voice-clone
 */
router.post("/", upload.array("files", 10), async (req, res) => {
  const requestId = `voice-clone-${Date.now()}`;

  try {
    console.log(`🎤 Voice clone request started: ${requestId}`);

    // Step 1: Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await AuthService.verifyUser(
      authHeader
    );

    if (authError) {
      console.log(`❌ Auth failed for request ${requestId}:`, authError);
      return res.status(authError.status).json(authError);
    }

    console.log(`✅ User authenticated: ${user.email} (${user.id})`);

    // Step 2: Validate input
    const { name } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      console.log(`❌ Invalid name for request ${requestId}:`, name);
      return res.status(400).json({
        success: false,
        error: "Name is required and must be a non-empty string",
        requestId,
      });
    }

    if (!files || files.length === 0) {
      console.log(`❌ No files provided for request ${requestId}`);
      return res.status(400).json({
        success: false,
        error: "At least one audio file is required",
        requestId,
      });
    }

    console.log(`📁 Files received: ${files.length} files`);

    // Validate each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) {
        console.log(`❌ File ${i + 1} is undefined`);
        return res.status(400).json({
          success: false,
          error: `File ${i + 1} is missing or invalid`,
          requestId,
        });
      }

      console.log(
        `📄 File ${i + 1}: ${file.originalname}, size: ${file.size}, type: ${
          file.mimetype
        }`
      );

      // Check for empty files
      if (file.size === 0) {
        console.log(`❌ File ${i + 1} is empty: ${file.originalname}`);
        return res.status(400).json({
          success: false,
          error: `File "${file.originalname}" is empty. Please record a valid audio file.`,
          requestId,
        });
      }

      // Check minimum size (at least 1KB for a meaningful audio file)
      if (file.size < 1000) {
        console.log(
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
      if (file.size > 10 * 1024 * 1024) {
        console.log(
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
          ).toFixed(1)}MB). Maximum size is 10MB.`,
          requestId,
        });
      }
    }

    // Step 3: Test ElevenLabs API connectivity
    console.log(`🔍 Testing ElevenLabs API connectivity...`);

    try {
      // Test API by listing voices (simple test)
      await elevenLabs.voices.getAll();
      console.log(`✅ ElevenLabs API test successful`);
    } catch (testError: any) {
      console.log(`❌ ElevenLabs API test error:`, testError.message);
      return res.status(502).json({
        success: false,
        error: `Cannot connect to ElevenLabs: ${testError.message}`,
        requestId,
      });
    }

    // Step 4: Upload to ElevenLabs using SDK
    console.log(`🚀 Starting ElevenLabs upload process...`);

    try {
      // Prepare files for ElevenLabs SDK
      console.log(`📤 Preparing ${files.length} files for ElevenLabs...`);

      files.forEach((file, index) => {
        const fileName = file.originalname || `recording-${index + 1}.m4a`;
        console.log(
          `📄 File ${index + 1}: ${fileName}, size: ${file.size}, type: ${
            file.mimetype
          }`
        );
      });

      // Create voice clone using official ElevenLabs SDK
      console.log(
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

      console.log(
        `✅ ElevenLabs upload successful, voice_id: ${elevenlabsResult.voiceId}`
      );

      if (!elevenlabsResult.voiceId) {
        console.log(`❌ ElevenLabs upload failed:`, elevenlabsResult);
        return res.status(502).json({
          success: false,
          error: `ElevenLabs error: ${elevenlabsResult}`,
          requestId,
        });
      }

      // Step 5: Save to database
      console.log(`💾 Saving to database...`);

      // Get existing voice clone if any
      const { data: existingVoiceClone } = await supabase
        .from("voice_clones")
        .select("*")
        .eq("user_id", user.id)
        .single();

      // Prepare database record
      const voiceCloneData = {
        id: existingVoiceClone?.id,
        user_id: user.id,
        elevenlabs_voice_id: elevenlabsResult.voiceId,
        status: "ready",
        sample_files: files.map((f: any, i: number) => ({
          name: f.originalname || `recording-${i + 1}.m4a`,
          size: f.size,
        })),
      };

      // Update or create voice clone
      const { data: dbData, error: dbError } = await supabase
        .from("voice_clones")
        .upsert(voiceCloneData)
        .select();

      if (dbError) {
        console.log(`❌ Database save failed:`, dbError);
        return res.status(500).json({
          success: false,
          error: `Database error: ${dbError.message}`,
          requestId,
        });
      }

      console.log(
        `✅ Voice clone created successfully: ${elevenlabsResult.voiceId}`
      );

      // Step 6: Return success response
      return res.status(200).json({
        success: true,
        voice_id: elevenlabsResult.voiceId,
        message: "Voice clone created successfully",
        requestId,
      });
    } catch (elevenLabsError: any) {
      console.log(`❌ ElevenLabs SDK error:`, elevenLabsError);
      return res.status(502).json({
        success: false,
        error: `ElevenLabs error: ${elevenLabsError.message}`,
        requestId,
      });
    }
  } catch (error: any) {
    console.error(`❌ Voice clone request failed:`, error);

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
});

export default router;
