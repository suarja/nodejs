import { Router, Request, Response } from "express";
import { PromptService } from "../../services/promptService";
import { createOpenAIClient } from "../../config/openai";
import { ClerkAuthService } from "../../services/clerkAuthService";
const router = Router();

/**
 * Enhance a user prompt using the prompt-enhancer-agent
 */
router.post("/enhance", async (req: Request, res: Response) => {
  try {
    // Verify authentication
    const { errorResponse: authError } = await ClerkAuthService.verifyUser(
      req.headers.authorization
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { userInput, outputLanguage = "en" } = req.body;

    if (!userInput || typeof userInput !== "string") {
      return res.status(400).json({
        error: "Missing or invalid userInput",
        code: "INVALID_INPUT",
      });
    }

    console.log("🔄 Enhancing prompt...");

    // Get the prompt-enhancer-agent template
    const promptTemplate = PromptService.fillPromptTemplate(
      "prompt-enhancer-agent",
      {
        outputLanguage,
        userInput,
        systemInput: "", // No system input for basic enhancement
      }
    );

    if (!promptTemplate) {
      return res.status(500).json({
        error: "Prompt template not found",
        code: "TEMPLATE_NOT_FOUND",
      });
    }

    console.log("🔄 Prompt template:", promptTemplate);

    // Use OpenAI to enhance the prompt
    const openai = createOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: promptTemplate.system,
        },
        {
          role: "user",
          content: promptTemplate.user,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const enhancedPrompt = completion.choices[0]?.message?.content;
    console.log("🔄 Enhanced prompt:", enhancedPrompt);
    if (!enhancedPrompt) {
      return res.status(500).json({
        error: "Failed to enhance prompt",
        code: "ENHANCEMENT_FAILED",
      });
    }

    console.log("✅ Prompt enhanced successfully");

    return res.json({
      enhancedPrompt: enhancedPrompt.trim(),
      originalPrompt: userInput,
      language: outputLanguage,
    });
  } catch (error) {
    console.error("❌ Error enhancing prompt:", error);

    if (error instanceof Error && error.message.includes("authentication")) {
      return res.status(401).json({
        error: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Enhance a system prompt using the system-prompt-enhancer-agent
 */
router.post("/enhance-system", async (req: Request, res: Response) => {
  try {
    // Verify authentication
    const { errorResponse: authError } = await ClerkAuthService.verifyUser(
      req.headers.authorization
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { userInput, mainPrompt, outputLanguage = "en" } = req.body;

    if (!userInput || typeof userInput !== "string") {
      return res.status(400).json({
        error: "Missing or invalid userInput",
        code: "INVALID_INPUT",
      });
    }

    if (!mainPrompt || typeof mainPrompt !== "string") {
      return res.status(400).json({
        error: "Missing or invalid mainPrompt",
        code: "INVALID_MAIN_PROMPT",
      });
    }

    console.log("🔄 Enhancing system prompt...");

    // Get the system-prompt-enhancer-agent template
    const promptTemplate = PromptService.fillPromptTemplate(
      "system-prompt-enhancer-agent",
      {
        outputLanguage,
        userInput,
        mainPrompt,
      }
    );

    if (!promptTemplate) {
      return res.status(500).json({
        error: "Prompt template not found",
        code: "TEMPLATE_NOT_FOUND",
      });
    }

    // Use OpenAI to enhance the system prompt
    const openai = createOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: promptTemplate.system,
        },
        {
          role: "user",
          content: promptTemplate.user,
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const enhancedPrompt = completion.choices[0]?.message?.content;

    if (!enhancedPrompt) {
      return res.status(500).json({
        error: "Failed to enhance system prompt",
        code: "ENHANCEMENT_FAILED",
      });
    }

    console.log("✅ System prompt enhanced successfully");

    return res.json({
      enhancedPrompt: enhancedPrompt.trim(),
      originalPrompt: userInput,
      language: outputLanguage,
    });
  } catch (error) {
    console.error("❌ Error enhancing system prompt:", error);

    if (error instanceof Error && error.message.includes("authentication")) {
      return res.status(401).json({
        error: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Generate a system prompt using the system-prompt-generator-agent
 */
router.post("/generate-system", async (req: Request, res: Response) => {
  try {
    // Verify authentication
    const { errorResponse: authError } = await ClerkAuthService.verifyUser(
      req.headers.authorization
    );

    if (authError) {
      return res.status(authError.status).json(authError);
    }

    const { mainPrompt, outputLanguage = "en" } = req.body;

    if (!mainPrompt || typeof mainPrompt !== "string") {
      return res.status(400).json({
        error: "Missing or invalid mainPrompt",
        code: "INVALID_MAIN_PROMPT",
      });
    }

    console.log("🔄 Generating system prompt...");

    // Get the system-prompt-generator-agent template
    const promptTemplate = PromptService.fillPromptTemplate(
      "system-prompt-generator-agent",
      {
        outputLanguage,
        mainPrompt,
      }
    );

    if (!promptTemplate) {
      return res.status(500).json({
        error: "Prompt template not found",
        code: "TEMPLATE_NOT_FOUND",
      });
    }

    // Use OpenAI to generate the system prompt
    const openai = createOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: promptTemplate.system,
        },
        {
          role: "user",
          content: promptTemplate.user,
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const generatedPrompt = completion.choices[0]?.message?.content;

    if (!generatedPrompt) {
      return res.status(500).json({
        error: "Failed to generate system prompt",
        code: "GENERATION_FAILED",
      });
    }

    console.log("✅ System prompt generated successfully");

    return res.json({
      generatedPrompt: generatedPrompt.trim(),
      language: outputLanguage,
    });
  } catch (error) {
    console.error("❌ Error generating system prompt:", error);

    if (error instanceof Error && error.message.includes("authentication")) {
      return res.status(401).json({
        error: "Authentication failed",
        code: "AUTH_FAILED",
      });
    }

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
