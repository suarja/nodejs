import express from "express";
import multer from "multer";
import { AuthService } from "../../services/authService";
import { supabase } from "../../config/supabase";

const router = express.Router();

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
    const { user, errorResponse: authError } = await AuthService.verifyUser(
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

    // Step 5: Process audio file (basic storage for now)
    console.log(`🎤 Processing audio file...`);

    // For now, we'll just acknowledge the audio without processing
    // In the future, this could include transcription or voice analysis

    console.log(`✅ Onboarding processed successfully`);

    // Step 6: Return success response
    return res.status(200).json({
      success: true,
      message: "Onboarding completed successfully",
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
