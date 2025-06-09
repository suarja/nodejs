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
  placement?: 'top' | 'center' | 'bottom';
  transcriptColor?: string;
  transcriptEffect?:
    | 'karaoke'
    | 'highlight'
    | 'fade'
    | 'bounce'
    | 'slide'
    | 'enlarge';
}

/**
 * Available video presets (extended with new effects)
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
  {
    id: 'highlight-yellow',
    name: 'Highlight Yellow',
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
    transcript_color: '#FFE500',
    transcript_maximum_length: 25,
    width: '90%',
    height: '100%',
    placement: 'bottom',
  },
  {
    id: 'fade',
    name: 'Fade',
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
    transcript_effect: 'fade',
    transcript_placement: 'animate',
    transcript_color: '#ffffff',
    transcript_maximum_length: 25,
    width: '90%',
    height: '100%',
    placement: 'bottom',
  },
  {
    id: 'bounce',
    name: 'Bounce',
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
    transcript_effect: 'bounce',
    transcript_placement: 'animate',
    transcript_color: '#ff4081',
    transcript_maximum_length: 25,
    width: '90%',
    height: '100%',
    placement: 'bottom',
  },
  {
    id: 'slide',
    name: 'Slide',
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
    transcript_effect: 'slide',
    transcript_placement: 'animate',
    transcript_color: '#00bcd4',
    transcript_maximum_length: 25,
    width: '90%',
    height: '100%',
    placement: 'bottom',
  },
  {
    id: 'enlarge',
    name: 'Enlarge',
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
    transcript_effect: 'enlarge',
    transcript_placement: 'animate',
    transcript_color: '#9c27b0',
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
    case 'center':
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
  console.log(
    '🚧 convertCaptionConfigToProperties called with config:',
    JSON.stringify(config, null, 2)
  );
  // If no config provided, return default karaoke settings
  if (!config) {
    console.log('🚧 No config provided, returning default karaoke settings 🚧');
    return getDefaultCaptionProperties();
  }

  // If captions are disabled, return empty object (will be handled by disableCaptions method)
  if (config.enabled === false) {
    console.log('🚧 Captions are disabled, returning empty object 🚧');
    return {};
  }

  const result = convertConfigToProperties(config);
  console.log(
    '🚧 Final caption properties result:',
    JSON.stringify(result, null, 2)
  );
  return result;
}

/**
 * Convert configuration to Creatomate properties
 */
function convertConfigToProperties(config: CaptionConfig): Record<string, any> {
  console.log(
    '🚧 convertConfigToProperties called with presetId:',
    config.presetId
  );
  // If config provided but no presetId, use defaults with custom overrides
  if (!config.presetId) {
    console.log('🚧 No presetId provided, using default properties 🚧');
    const defaultProps = getDefaultCaptionProperties();
    return applyCustomOverrides(defaultProps, config);
  }

  // Find the preset, default to karaoke if not found
  const foundPreset = VIDEO_PRESETS.find((p) => p.id === config.presetId);
  console.log('🚧 Searching for preset with id:', config.presetId);
  console.log(
    '🚧 Available preset IDs:',
    VIDEO_PRESETS.map((p) => p.id)
  );
  console.log('🚧 Found preset:', foundPreset ? foundPreset.id : 'NOT FOUND');

  if (!foundPreset) {
    console.log('🚧 Preset not found, falling back to karaoke 🚧');
  }

  const activePreset = foundPreset || getKaraokePreset();
  console.log('🚧 Active preset ID:', activePreset.id);

  // Convert preset properties to Creatomate format
  const baseProperties = presetToCreatomateProperties(activePreset);
  console.log(
    '🚧 Base properties from preset:',
    JSON.stringify(baseProperties, null, 2)
  );

  // Apply custom overrides from config
  const finalProperties = applyCustomOverrides(baseProperties, config);
  console.log(
    '🚧 Properties after custom overrides:',
    JSON.stringify(finalProperties, null, 2)
  );
  return finalProperties;
}

/**
 * Get default caption properties (Karaoke preset)
 */
function getDefaultCaptionProperties(): Record<string, any> {
  console.log('🚧 getDefaultCaptionProperties 🚧');
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

/**
 * Get Karaoke preset as fallback
 */
function getKaraokePreset(): VideoPreset {
  console.log('🚧 getKaraokePreset 🚧');
  const karaokePreset = VIDEO_PRESETS.find((p) => p.id === 'karaoke');
  console.log('🚧 Karaoke preset: ', karaokePreset);
  if (!karaokePreset) {
    // This should never happen since we include karaoke in VIDEO_PRESETS
    // But provide a safe fallback just in case
    if (VIDEO_PRESETS.length === 0) {
      throw new Error('No video presets available');
    }
    const firstPreset = VIDEO_PRESETS[0];
    if (!firstPreset) {
      throw new Error('No valid video preset found');
    }
    return firstPreset;
  }
  return karaokePreset;
}

/**
 * Convert preset to Creatomate properties
 */
function presetToCreatomateProperties(
  preset: VideoPreset
): Record<string, any> {
  return {
    width: preset.width,
    height: preset.height,
    font_size: preset.font_size,
    fill_color: preset.fill_color,
    font_family: preset.font_family,
    font_weight: preset.font_weight,
    x_alignment: '50%',
    y_alignment: mapPlacementToYAlignment(preset.placement),
    stroke_color: preset.stroke_color,
    stroke_width: preset.stroke_width,
    background_color: preset.background_color || 'rgba(216,216,216,0)',
    transcript_color: preset.transcript_color,
    transcript_effect: preset.transcript_effect,
    background_x_padding: preset.background_x_padding || '26%',
    background_y_padding: preset.background_y_padding || '7%',
    transcript_placement: preset.transcript_placement,
    background_border_radius: preset.background_border_radius || '28%',
    transcript_maximum_length: preset.transcript_maximum_length,
  };
}

/**
 * Apply custom overrides from config
 */
function applyCustomOverrides(
  baseProperties: Record<string, any>,
  config: CaptionConfig
): Record<string, any> {
  console.log('🚧 applyCustomOverrides 🚧');
  const result = { ...baseProperties };

  // Override placement if specified
  if (config.placement) {
    console.log('🚧 Placement specified, overriding y_alignment 🚧');
    result.y_alignment = mapPlacementToYAlignment(config.placement);
  }

  // Override transcript color if specified
  if (config.transcriptColor) {
    console.log(
      '🚧 Transcript color specified, overriding transcript_color 🚧'
    );
    result.transcript_color = config.transcriptColor;
  }

  // Override transcript effect if specified
  if (config.transcriptEffect) {
    console.log(
      '🚧 Transcript effect specified, overriding transcript_effect 🚧'
    );
    result.transcript_effect = config.transcriptEffect;
  }

  return result;
}

/**
 * Get available preset IDs
 */
export function getAvailablePresetIds(): string[] {
  console.log('🚧 getAvailablePresetIds 🚧');
  return VIDEO_PRESETS.map((preset) => preset.id);
}

/**
 * Check if a preset ID is valid
 */
export function isValidPresetId(presetId: string): boolean {
  console.log('🚧 isValidPresetId 🚧');
  return VIDEO_PRESETS.some((preset) => preset.id === presetId);
}

/**
 * Get available transcript effects
 */
export function getAvailableTranscriptEffects(): string[] {
  console.log('🚧 getAvailableTranscriptEffects 🚧');
  return ['karaoke', 'highlight', 'fade', 'bounce', 'slide', 'enlarge'];
}

/**
 * Check if a transcript effect is valid
 */
export function isValidTranscriptEffect(effect: string): boolean {
  console.log('🚧 isValidTranscriptEffect 🚧');
  return getAvailableTranscriptEffects().includes(effect);
}
