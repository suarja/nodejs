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
  presetId?: string;
  placement?: 'top' | 'middle' | 'bottom';
  highlightColor?: string;
}

/**
 * Available video presets (from lib/config/video-presets.ts)
 */
const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: 'karaoke',
    name: 'Karaoke',
    font_family: 'Montserrat',
    font_weight: '700',
    font_size: '8 vmin',
    fill_color: '#ffffff',
    stroke_color: '#333333',
    stroke_width: '1.05 vmin',
    background_color: 'rgba(216,216,216,0)',
    background_x_padding: '26%',
    background_y_padding: '7%',
    background_border_radius: '28%',
    transcript_effect: 'karaoke',
    transcript_placement: 'animate',
    transcript_color: '#04f827',
    transcript_maximum_length: 25,
    width: '90%',
    height: '100%',
    placement: 'bottom',
  },
  {
    id: 'beasty',
    name: 'Beasty',
    font_family: 'Montserrat',
    font_weight: '700',
    font_size: '8 vmin',
    fill_color: '#ffffff',
    stroke_color: '#333333',
    stroke_width: '1.05 vmin',
    background_color: 'rgba(216,216,216,0)',
    background_x_padding: '26%',
    background_y_padding: '7%',
    background_border_radius: '28%',
    transcript_effect: 'highlight',
    transcript_placement: 'animate',
    transcript_color: '#FFFD03',
    transcript_maximum_length: 25,
    width: '90%',
    height: '100%',
    placement: 'bottom',
  },
];

/**
 * Maps placement to y_alignment value
 * @param placement The placement option
 * @returns The y_alignment percentage
 */
function mapPlacementToYAlignment(placement: string): string {
  switch (placement) {
    case 'top':
      return '10%';
    case 'middle':
      return '50%';
    case 'bottom':
    default:
      return '90%';
  }
}

/**
 * Converts a caption configuration to Creatomate text element properties
 * @param config The caption configuration from user input
 * @returns Properties to apply to Creatomate text elements
 */
export function convertCaptionConfigToProperties(
  config: CaptionConfig | null | undefined
): Record<string, any> {
  // If no config provided, return default karaoke settings
  if (!config) {
    return {
      width: '90%',
      height: '100%',
      font_size: '8 vmin',
      fill_color: '#ffffff',
      font_family: 'Montserrat',
      font_weight: '700',
      x_alignment: '50%',
      y_alignment: '90%',
      stroke_color: '#333333',
      stroke_width: '1.05 vmin',
      background_color: 'rgba(216,216,216,0)',
      transcript_color: '#04f827',
      transcript_effect: 'karaoke',
      background_x_padding: '26%',
      background_y_padding: '7%',
      transcript_placement: 'animate',
      background_border_radius: '28%',
      transcript_maximum_length: 25,
    };
  }

  // If config provided but no presetId, handle placement separately
  if (!config.presetId) {
    const placement = config.placement || 'bottom';
    const yAlignment = mapPlacementToYAlignment(placement);

    return {
      width: '90%',
      height: '100%',
      font_size: '8 vmin',
      fill_color: '#ffffff',
      font_family: 'Montserrat',
      font_weight: '700',
      x_alignment: '50%',
      y_alignment: yAlignment,
      stroke_color: '#333333',
      stroke_width: '1.05 vmin',
      background_color: 'rgba(216,216,216,0)',
      transcript_color: config.highlightColor || '#04f827',
      transcript_effect: 'karaoke',
      background_x_padding: '26%',
      background_y_padding: '7%',
      transcript_placement: 'animate',
      background_border_radius: '28%',
      transcript_maximum_length: 25,
    };
  }

  // Find the preset, default to karaoke if not found
  const foundPreset = VIDEO_PRESETS.find((p) => p.id === config.presetId);
  const activePreset = foundPreset || {
    id: 'karaoke',
    name: 'Karaoke',
    font_family: 'Montserrat',
    font_weight: '700',
    font_size: '8 vmin',
    fill_color: '#ffffff',
    stroke_color: '#333333',
    stroke_width: '1.05 vmin',
    background_color: 'rgba(216,216,216,0)',
    background_x_padding: '26%',
    background_y_padding: '7%',
    background_border_radius: '28%',
    transcript_effect: 'karaoke',
    transcript_placement: 'animate',
    transcript_color: '#04f827',
    transcript_maximum_length: 25,
    width: '90%',
    height: '100%',
    placement: 'bottom',
  };

  // Map placement to y_alignment
  // Use config placement if provided, otherwise use preset default
  const placement = config.placement || activePreset.placement;
  const yAlignment = mapPlacementToYAlignment(placement);

  // Convert preset properties to Creatomate format
  return {
    width: activePreset.width,
    height: activePreset.height,
    font_size: activePreset.font_size,
    fill_color: activePreset.fill_color,
    font_family: activePreset.font_family,
    font_weight: activePreset.font_weight,
    x_alignment: '50%',
    y_alignment: yAlignment,
    stroke_color: activePreset.stroke_color,
    stroke_width: activePreset.stroke_width,
    background_color: activePreset.background_color || 'rgba(216,216,216,0)',
    transcript_color: config.highlightColor || activePreset.transcript_color,
    transcript_effect: activePreset.transcript_effect,
    background_x_padding: activePreset.background_x_padding || '26%',
    background_y_padding: activePreset.background_y_padding || '7%',
    transcript_placement: activePreset.transcript_placement,
    background_border_radius: activePreset.background_border_radius || '28%',
    transcript_maximum_length: activePreset.transcript_maximum_length,
  };
}

/**
 * Get available preset IDs
 */
export function getAvailablePresetIds(): string[] {
  return VIDEO_PRESETS.map((preset) => preset.id);
}

/**
 * Check if a preset ID is valid
 */
export function isValidPresetId(presetId: string): boolean {
  return VIDEO_PRESETS.some((preset) => preset.id === presetId);
}
