import { jest, describe, test, expect } from "@jest/globals";
import dotenv from "dotenv";
import { CreatomateBuilder } from "../../src/services/creatomateBuilder";
import { ValidatedVideo, EditorialProfile } from "../../src/types/video";
import winston from "winston";
import { z } from "zod";

// Load environment variables for the test
dotenv.config();

// Define a schema to validate the structure of the final template's elements
const VideoElementSchema = z.object({
  type: z.literal("video"),
  source: z.string().url(),
  trim_start: z.string().optional().nullable(),
  trim_duration: z.string().optional().nullable(),
  fit: z.literal("cover"),
  duration: z.null(),
});

// Mock the logger to keep the test output clean
const mockLogger = winston.createLogger({
  transports: [new winston.transports.Console({ silent: true })],
});

// Conditionally run this test only if the OpenAI API key is available
const e2e_test = process.env.OPENAI_API_KEY ? describe : describe.skip;

e2e_test("CreatomateBuilder E2E Test", () => {
  test("should generate a valid Creatomate template using real OpenAI calls", async () => {
    // Arrange: Set up the test data
    const builder = CreatomateBuilder.getInstance("gpt-4o-mini");

    const selectedVideos: ValidatedVideo[] = [
      {
        id: "video1",
        upload_url:
          "https://creatomate-sdks-samples.s3.amazonaws.com/stock-footage-typing.mp4",
        title: "Video with Analysis",
        description: "A video that has analysis data for keyboard typing.",
        tags: ["tech", "keyboard"],
        user_id: "user1",
        analysis_data: {
          segments: [
            {
              start_time: "00:05",
              end_time: "00:12",
              key_points: ["A person is typing on a black keyboard."],
              description:
                "Close-up shot of hands typing on a modern keyboard.",
            },
          ],
        },
      },
      {
        id: "video2",
        upload_url:
          "https://creatomate-sdks-samples.s3.amazonaws.com/stock-footage-forest.mp4",
        title: "Video without Analysis",
        description: "A calming shot of a sunlit forest.",
        tags: ["nature", "forest"],
        user_id: "user1",
        analysis_data: null,
      },
    ];

    const params = {
      script:
        "Scene 1: Show someone typing on a keyboard. Scene 2: Transition to a peaceful forest scene.",
      selectedVideos,
      voiceId: "test-voice",
      editorialProfile: {} as EditorialProfile,
      captionStructure: {},
      agentPrompt: "",
      logger: mockLogger,
    };

    // Act: Run the builder
    const finalTemplate = await builder.buildJson(params);

    // Assert: Validate the output
    console.log("Generated Template:", JSON.stringify(finalTemplate, null, 2));

    // 1. Basic structure validation
    expect(finalTemplate).toBeDefined();
    expect(finalTemplate.width).toBe(1080);
    expect(finalTemplate.height).toBe(1920);
    expect(finalTemplate.elements).toBeInstanceOf(Array);
    expect(finalTemplate.elements.length).toBeGreaterThan(0);

    const validUrls = selectedVideos.map((v) => v.upload_url);

    // 2. Validate each video element in the template
    finalTemplate.elements.forEach((scene: any) => {
      const videoElement = scene.elements.find((e: any) => e.type === "video");
      expect(videoElement).toBeDefined();

      // Ensure the URL is one of the provided valid URLs
      expect(validUrls).toContain(videoElement.source);

      // Validate the structure of the video element
      const validationResult = VideoElementSchema.safeParse(videoElement);
      expect(validationResult.success).toBe(true);
    });
  }, 90000); // Increase timeout to 90 seconds for real API calls
});
