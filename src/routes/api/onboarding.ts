import express from "express";
import multer from "multer";
import { Readable } from "stream";
import { supabase } from "../../config/supabase";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { ClerkAuthService } from "../../services/clerkAuthService";

const router = express.Router();

// ElevenLabs API configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const elevenLabs = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/**
 * Process onboarding recording
 * POST /api/onboarding
 */
router.post("/", upload.single("file"), async (req, res) => {
  const requestId = `onboarding-${Date.now()}`;

  try {
    console.log(`📋 Onboarding request started: ${requestId}`);

    // Step 1: Authenticate user
    const authHeader = req.headers.authorization;
    const { user, errorResponse: authError } = await ClerkAuthService.verifyUser(
      authHeader
    );

    if (authError) {
      console.log(`❌ Auth failed for request ${requestId}:`, authError);
      return res.status(authError.status).json(authError);
    }

    console.log(`✅ User authenticated: ${user.email} (${user.id})`);

    // Step 2: Validate input
    const file = req.file;
    const surveyData = req.body.survey_data
      ? JSON.parse(req.body.survey_data)
      : null;
    const enableVoiceClone = req.body.enable_voice_clone === 'true';

    if (!file) {
      console.log(`❌ No audio file provided for request ${requestId}`);
      return res.status(400).json({
        success: false,
        error: "Audio file is required",
        requestId,
      });
    }

    console.log(
      `📁 Audio file received: ${file.originalname}, size: ${file.size}, type: ${file.mimetype}`
    );
    console.log(`🔊 Voice clone enabled: ${enableVoiceClone}`);

    // Step 3: Save survey data to database
    if (surveyData) {
      console.log(`💾 Saving survey data...`);

      const { error: surveyError } = await supabase
        .from("onboarding_survey")
        .upsert({
          user_id: user.id,
          content_goals: surveyData.content_goals || null,
          pain_points: surveyData.pain_points || null,
          content_style: surveyData.content_style || null,
          platform_focus: surveyData.platform_focus || null,
          content_frequency: surveyData.content_frequency || null,
        });

      if (surveyError) {
        console.log(`❌ Survey save failed:`, surveyError);
        // Continue anyway, don't block for survey errors
      } else {
        console.log(`✅ Survey data saved successfully`);
      }
    }

    // Step 4: Create default editorial profile
    console.log(`📝 Creating editorial profile...`);

    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from("editorial_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!existingProfile) {
        const defaultDescription = surveyData?.content_style
          ? `Créateur de contenu axé sur ${surveyData.content_style}`
          : "Créateur de contenu digital";

        const defaultAudience = surveyData?.platform_focus
          ? `Audience sur la plateforme ${surveyData.platform_focus}`
          : "Audience générale";

        const { error: profileError } = await supabase
          .from("editorial_profiles")
          .insert({
            user_id: user.id,
            persona_description: defaultDescription,
            tone_of_voice: "Professionnel et informatif",
            audience: defaultAudience,
            style_notes: "Préfère un style concis et direct",
          });

        if (profileError) {
          console.log(`❌ Editorial profile creation failed:`, profileError);
        } else {
          console.log(`✅ Editorial profile created successfully`);
        }
      }
    } catch (profileErr) {
      console.log(`❌ Editorial profile error:`, profileErr);
      // Continue anyway
    }

    // Step 5: Check if user already has a voice clone
    console.log(`🔍 Checking for existing voice clone...`);

    const { data: existingVoice } = await supabase
      .from("voice_clones")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let voiceCreated = false;
    let voiceId = null;

    if (existingVoice) {
      console.log(
        `⚠️ User already has voice clone: ${existingVoice.elevenlabs_voice_id}`
      );
      console.log(
        `📋 Skipping voice creation, creating editorial profile only`
      );
      voiceId = existingVoice.elevenlabs_voice_id;
    } else if (enableVoiceClone) {
      // Step 6: Create voice clone from audio file (only if enabled)
      console.log(`🎤 Creating voice clone from audio file...`);

      try {
        // Validate file size
        if (file.size < 1000) {
          console.log(`❌ File too small: ${file.size} bytes`);
          return res.status(400).json({
            success: false,
            error: `Audio file too small (${file.size} bytes). Please record at least 3 seconds of audio.`,
            requestId,
          });
        }

        // Create voice clone using ElevenLabs
        const voiceName = `${user.email.split("@")[0]}_voice_${Date.now()}`;

        console.log(`📡 Creating voice in ElevenLabs: ${voiceName}`);

        const stream = Readable.from(file.buffer);
        (stream as any).name = file.originalname;

        const elevenlabsResult = await elevenLabs.voices.ivc.create({
          files: [stream as any],
          name: voiceName,
        });

        if (!elevenlabsResult.voiceId) {
          throw new Error("ElevenLabs voice creation failed");
        }

        console.log(
          `✅ Voice created in ElevenLabs: ${elevenlabsResult.voiceId}`
        );

        // Save voice to database
        const { error: voiceError } = await supabase
          .from("voice_clones")
          .insert({
            user_id: user.id,
            elevenlabs_voice_id: elevenlabsResult.voiceId,
            status: "ready",
            sample_files: [
              {
                name: file.originalname || "onboarding_recording.m4a",
                size: file.size,
              },
            ],
          });

        if (voiceError) {
          console.log(`❌ Voice database save failed:`, voiceError);
          // Continue anyway, the voice exists in ElevenLabs
        } else {
          console.log(`✅ Voice saved to database`);
        }

        voiceCreated = true;
        voiceId = elevenlabsResult.voiceId;
      } catch (voiceError: any) {
        console.log(`❌ Voice creation failed:`, voiceError.message);
        // Continue with profile creation anyway
        console.log(`📋 Continuing with editorial profile creation only`);
      }
    } else {
      console.log(`📋 Voice clone disabled by user preference, skipping voice creation`);
    }

    console.log(`✅ Onboarding processed successfully`);

    // Step 7: Return success response
    return res.status(200).json({
      success: true,
      message: "Onboarding completed successfully",
      data: {
        voiceCreated,
        voiceId,
        profileCreated: true,
        existingVoice: !!existingVoice,
      },
      requestId,
    });
  } catch (error: any) {
    console.error(`❌ Onboarding request failed:`, error);

    return res.status(500).json({
      success: false,
      error: error.message || "Internal server error",
      requestId,
    });
  }
});

export default router;
