/**
 * Simplified caption configuration type for server use
 */
interface CaptionConfiguration {
  presetId?: string;
  placement?: 'top' | 'middle' | 'bottom';
  highlightColor?: string;
}

/**
 * Converts a CaptionConfiguration to the Creatomate JSON structure
 * @param config The caption configuration from the UI
 * @returns A JSON object in the format expected by Creatomate
 */
export function convertCaptionConfigToCreatomate(
  config: CaptionConfiguration | null | undefined
): Record<string, any> {
  if (!config || !config.presetId) {
    // Return default structure if no config provided
    return {
      elements: [
        {
          id: 'caption-1',
          name: 'Subtitle-2',
          type: 'text',
          track: 2,
          time: 0,
          duration: null,
          x: '50%',
          y: '90%',
          width: '86.66%',
          height: '100.71%',
          font_family: 'Montserrat',
          font_weight: '700',
          font_size: '40px',
          text_transform: 'uppercase',
          fill_color: '#FFFFFF',
          stroke_color: '#000000',
          stroke_width: '8px',
          shadow_color: '#000000',
          shadow_blur: '2px',
          shadow_x: '2px',
          shadow_y: '2px',
          transcript_effect: 'karaoke',
          transcript_placement: 'bottom',
          transcript_maximum_length: 14,
          highlight_color: '#04f827',
        },
      ],
    };
  }

  // Simple preset mapping for server use
  const placement = config.placement || 'bottom';

  // Map placement to y position
  let yPosition = '80%'; // Default bottom
  if (placement === 'top') {
    yPosition = '20%';
  } else if (placement === 'middle') {
    yPosition = '50%';
  }

  return {
    elements: [
      {
        id: 'caption-1',
        name: 'Subtitle-2',
        type: 'text',
        track: 2,
        time: 0,
        duration: null,
        x: '50%',
        y: yPosition,
        width: '86.66%',
        height: '100.71%',
        font_family: 'Montserrat',
        font_weight: '700',
        font_size: '40px',
        text_transform: 'uppercase',
        fill_color: '#FFFFFF',
        stroke_color: '#000000',
        stroke_width: '8px',
        shadow_color: '#000000',
        shadow_blur: '2px',
        shadow_x: '2px',
        shadow_y: '2px',
        transcript_effect: 'karaoke',
        transcript_placement: 'animate',
        transcript_maximum_length: 25,
        highlight_color: config.highlightColor || '#04f827',
      },
    ],
  };
}
