import winston from "winston";
import { CaptionConfiguration } from "../../types/video";

/**
 * Video preset configuration type
 */
interface VideoPreset {
  id: string;
  name: string;
  font_family: string;
  font_weight: string;
  font_size: string;
  fill_color: string;
  stroke_color: string;
  stroke_width: string;
  background_color?: string;
  background_x_padding?: string;
  background_y_padding?: string;
  background_border_radius?: string;
  transcript_effect: string;
  transcript_placement: string;
  transcript_color: string;
  transcript_maximum_length: number;
  width: string;
  height: string;
  placement: string;
}

/**
 * Caption configuration from user input
 */
interface CaptionConfig {
  enabled: boolean;
  presetId?: string;
  placement?: "top" | "center" | "bottom";
  transcriptColor?: string;
  transcriptEffect?:
    | "karaoke"
    | "highlight"
    | "fade"
    | "bounce"
    | "slide"
    | "enlarge";
}

/**
 * Available video presets (extended with new effects)
 */
const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: "karaoke",
    name: "Karaoke",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    background_border_radius: "28%",
    transcript_effect: "karaoke",
    transcript_placement: "animate",
    transcript_color: "#04f827",
    transcript_maximum_length: 25,
    width: "90%",
    height: "100%",
    placement: "bottom",
  },
  {
    id: "beasty",
    name: "Beasty",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    background_border_radius: "28%",
    transcript_effect: "highlight",
    transcript_placement: "animate",
    transcript_color: "#FFFD03",
    transcript_maximum_length: 25,
    width: "90%",
    height: "100%",
    placement: "bottom",
  },
  {
    id: "highlight-yellow",
    name: "Highlight Yellow",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    background_border_radius: "28%",
    transcript_effect: "highlight",
    transcript_placement: "animate",
    transcript_color: "#FFE500",
    transcript_maximum_length: 25,
    width: "90%",
    height: "100%",
    placement: "bottom",
  },
  {
    id: "fade",
    name: "Fade",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    background_border_radius: "28%",
    transcript_effect: "fade",
    transcript_placement: "animate",
    transcript_color: "#ffffff",
    transcript_maximum_length: 25,
    width: "90%",
    height: "100%",
    placement: "bottom",
  },
  {
    id: "bounce",
    name: "Bounce",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    background_border_radius: "28%",
    transcript_effect: "bounce",
    transcript_placement: "animate",
    transcript_color: "#ff4081",
    transcript_maximum_length: 25,
    width: "90%",
    height: "100%",
    placement: "bottom",
  },
  {
    id: "slide",
    name: "Slide",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    background_border_radius: "28%",
    transcript_effect: "slide",
    transcript_placement: "animate",
    transcript_color: "#00bcd4",
    transcript_maximum_length: 25,
    width: "90%",
    height: "100%",
    placement: "bottom",
  },
  {
    id: "enlarge",
    name: "Enlarge",
    font_family: "Montserrat",
    font_weight: "700",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    background_border_radius: "28%",
    transcript_effect: "enlarge",
    transcript_placement: "animate",
    transcript_color: "#9c27b0",
    transcript_maximum_length: 25,
    width: "90%",
    height: "100%",
    placement: "bottom",
  },
];

/**
 * Maps placement to y_alignment value
 * @param placement The placement option
 * @returns The y_alignment percentage
 */
function mapPlacementToYAlignment(placement: string): string {
  switch (placement) {
    case "top":
      return "10%";
    case "center":
      return "50%";
    case "bottom":
    default:
      return "90%";
  }
}

/**
 * Converts a caption configuration to Creatomate text element properties
 * @param config The caption configuration from user input
 * @returns Properties to apply to Creatomate text elements
 */
export function convertCaptionConfigToProperties(
  config: CaptionConfiguration | null | undefined,
  logger: winston.Logger
): Record<string, any> {
  logger.info(
    "🚧 convertCaptionConfigToProperties called with config:",
    JSON.stringify(config, null, 2)
  );

  // If no config provided, return default settings
  if (!config) {
    logger.info("🚧 No config provided, returning default settings 🚧");
    return getDefaultCaptionProperties();
  }

  // If captions are disabled, return empty object (will be handled by disableCaptions method)
  if (config.enabled === false) {
    logger.info("🚧 Captions are disabled, returning empty object 🚧");
    return {};
  }

  // Build properties directly from the config values
  const properties = {
    // Base layout properties
    width: "90%",
    height: "100%",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    font_family: "Montserrat",
    font_weight: "700",
    x_alignment: "50%",
    y_alignment: mapPlacementToYAlignment(config.placement || "bottom"),
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    background_x_padding: "26%",
    background_y_padding: "7%",
    transcript_placement: "animate",
    background_border_radius: "28%",
    transcript_maximum_length: 25,

    // User-specified properties
    transcript_color: config.transcriptColor || "#04f827",
    transcript_effect: config.transcriptEffect || "karaoke",
  };

  logger.info(
    "🚧 Final caption properties result:",
    JSON.stringify(properties, null, 2)
  );
  return properties;
}

/**
 * Get default caption properties (fallback when no config provided)
 */
function getDefaultCaptionProperties(): Record<string, any> {
  console.log("🚧 getDefaultCaptionProperties 🚧");
  return {
    width: "90%",
    height: "100%",
    font_size: "8 vmin",
    fill_color: "#ffffff",
    font_family: "Montserrat",
    font_weight: "700",
    x_alignment: "50%",
    y_alignment: "90%",
    stroke_color: "#333333",
    stroke_width: "1.05 vmin",
    background_color: "rgba(216,216,216,0)",
    transcript_color: "#04f827",
    transcript_effect: "karaoke",
    background_x_padding: "26%",
    background_y_padding: "7%",
    transcript_placement: "animate",
    background_border_radius: "28%",
    transcript_maximum_length: 25,
  };
}

/**
 * Get available transcript effects
 */
export function getAvailableTranscriptEffects(): string[] {
  console.log("🚧 getAvailableTranscriptEffects 🚧");
  return ["karaoke", "highlight", "fade", "bounce", "slide", "enlarge"];
}

/**
 * Check if a transcript effect is valid
 */
export function isValidTranscriptEffect(effect: string): boolean {
  console.log("🚧 isValidTranscriptEffect 🚧");
  return getAvailableTranscriptEffects().includes(effect);
}
