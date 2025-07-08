import { jest, describe, test, expect } from "@jest/globals";
import { CreatomateBuilder } from "../../src/services/creatomateBuilder";
import {
  ValidatedVideo,
  ScenePlan,
  EditorialProfile,
} from "../../src/types/video";
import winston from "winston";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

// Mock the OpenAI module
const mockParse = jest.fn<() => Promise<{ output_parsed: ScenePlan }>>();
const mockCreate =
  jest.fn<() => Promise<OpenAI.Chat.Completions.ChatCompletion>>();
jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    responses: {
      parse: mockParse,
    },
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

// Mock the logger
const mockLogger = winston.createLogger({
  transports: [new winston.transports.Console({ silent: true })],
});

describe("CreatomateBuilder with AI Judge and Trimming", () => {
  let builder: CreatomateBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockVideos: ValidatedVideo[] = [
    {
      id: "video1",
      upload_url: "https://correct.com/user1/video1.mp4",
      title: "Video with Analysis",
      description: "A video that has analysis data.",
      tags: ["tech", "keyboard"],
      user_id: "user1",
      analysis_data: {
        segments: [
          {
            start_time: "00:05",
            end_time: "00:12",
            key_points: ["typing on a keyboard"],
            description: "A person is typing on a keyboard.",
          },
        ],
      },
    },
    {
      id: "video2",
      upload_url: "https://correct.com/user1/video2.mp4",
      title: "Video without Analysis",
      description: "A video with no analysis.",
      tags: ["nature", "forest"],
      user_id: "user1",
      analysis_data: null,
    },
  ];

  const mockPlannerResponse: ScenePlan = {
    scenes: [
      {
        scene_number: 1,
        script_text: "First, we see someone typing on a keyboard.",
        video_asset: {
          id: "video1",
          // This URL is intentionally incorrect to test the repairer
          url: "https://wrong.com/user-wrong-id/video1.mp4",
          title: "Video with Analysis",
        },
        reasoning: "Matches the keyboard theme.",
      },
      {
        scene_number: 2,
        script_text: "Then, a calm shot of a forest.",
        video_asset: {
          id: "video2",
          url: "https://correct.com/user1/video2.mp4",
          title: "Video without Analysis",
        },
        reasoning: "Matches the nature theme.",
      },
    ],
  };

  const mockJudgeResponse: ScenePlan = {
    scenes: [
      {
        scene_number: 1,
        script_text: "First, we see someone typing on a keyboard.",
        video_asset: {
          id: "video1",
          url: "https://correct.com/user1/video1.mp4",
          title: "Video with Analysis",
          trim_start: "5",
          trim_duration: "7",
        },
        reasoning: "Corrected URL and added trim from analysis.",
      },
      {
        scene_number: 2,
        script_text: "Then, a calm shot of a forest.",
        video_asset: {
          id: "video2",
          url: "https://correct.com/user1/video2.mp4",
          title: "Video without Analysis",
        },
        reasoning: "URL was correct, no analysis data.",
      },
    ],
  };

  const mockTemplateResponse = {
    output_format: "mp4",
    width: 1080,
    height: 1920,
    elements: [
      {
        elements: [
          {
            type: "video",
            source: "https://correct.com/user1/video1.mp4",
            trim_start: "5",
            trim_duration: "7",
          },
        ],
      },
      {
        elements: [
          {
            type: "video",
            source: "https://correct.com/user1/video2.mp4",
          },
        ],
      },
    ],
  };

  test("should correctly use AI judge and analysis_data to build a template", async () => {
    const builder = CreatomateBuilder.getInstance("gpt-4o");

    // 1. Mock the responses for the AI calls
    mockParse
      .mockResolvedValueOnce({
        output_parsed: mockPlannerResponse,
      })
      .mockResolvedValueOnce({
        output_parsed: mockJudgeResponse,
      });

    mockCreate.mockResolvedValueOnce({
      id: "test-id",
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify(mockTemplateResponse),
            refusal: null,
          },
          finish_reason: "stop",
          index: 0,
          logprobs: null,
        },
      ],
      created: Date.now(),
      model: "gpt-4o",
      object: "chat.completion",
    });

    const params = {
      script: "A test script.",
      selectedVideos: mockVideos,
      voiceId: "test-voice",
      editorialProfile: {} as EditorialProfile,
      captionStructure: {},
      agentPrompt: "test-prompt",
      logger: mockLogger,
    };

    // Execute the builder
    const finalTemplate = await builder.buildJson(params);

    // Assertions
    expect(finalTemplate).toBeDefined();

    // Check if the final template reflects the repaired and trimmed video
    const firstVideoElement = finalTemplate.elements[0].elements.find(
      (e: any) => e.type === "video"
    );
    expect(firstVideoElement.source).toBe(
      "https://correct.com/user1/video1.mp4"
    );
    expect(firstVideoElement.trim_start).toBe("5");
    expect(firstVideoElement.trim_duration).toBe("7");

    // Check the second video element (no trim)
    const secondVideoElement = finalTemplate.elements[1].elements.find(
      (e: any) => e.type === "video"
    );
    expect(secondVideoElement.source).toBe(
      "https://correct.com/user1/video2.mp4"
    );
    expect(secondVideoElement.trim_start).toBeUndefined();
    expect(secondVideoElement.trim_duration).toBeUndefined();

    // Verify that the planner and judge were called
    expect(mockParse).toHaveBeenCalledTimes(2);

    // Verify the template generator was called
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe("patchAudioTextToSource", () => {
  test("should replace 'text' by 'source' in all audio elements in no.json", () => {
    // Charger le template depuis no.json
    const noJsonPath = path.join(__dirname, "./no.json");
    const raw = fs.readFileSync(noJsonPath, "utf-8");
    const data = JSON.parse(raw);
    // On cible le template dans data.modifications
    const template = data.modifications;

    // Instancier le builder
    const builder = CreatomateBuilder.getInstance("gpt-4o");
    // Appliquer le patch
    // @ts-ignore accès à la méthode privée pour le test
    builder.patchAudioTextToSource(template);

    // Parcourir récursivement tous les éléments audio
    template.elements.forEach((scene: any) => {
      scene.elements.forEach((element: any) => {
        if (element.type === "audio") {
          expect(element.text).toBeUndefined();
          expect(typeof element.source).toBe("string");
          expect(element.source.length).toBeGreaterThan(0);
        }
      });
    });
  });
});
