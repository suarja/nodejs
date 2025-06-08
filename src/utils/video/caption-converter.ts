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

/* 
 {
          "id": "caption-1",
          "name": "Subtitle-2",
          "type": "text",
          "track": 2,
          "time": 0,
          "width": "90%",
          "height": "100%",
          "x_alignment": "50%",
          "y_alignment": "90%",
          "font_family": "Montserrat",
          "font_weight": "700",
          "font_size": "8 vmin",
          "background_color": "rgba(216,216,216,0)",
          "background_x_padding": "26%",
          "background_y_padding": "7%",
          "background_border_radius": "28%",
          "transcript_source": "voice-scene-1",
          "transcript_effect": "karaoke",
          "transcript_placement": "animate",
          "transcript_maximum_length": 25,
          "transcript_color": "#04f827",
          "fill_color": "#ffffff",
          "stroke_color": "#333333",
          "stroke_width": "1.05 vmin"
        },
*/

/* 
   {
          "id": "0cf1a646-4a53-4483-bea9-9ce8eff9101c",
          "name": "Subtitles-1",
          "type": "text",
          "track": 2,
          "time": 0,
          "width": "90%",
          "height": "100%",
          "x_alignment": "50%",
          "y_alignment": "50%",
          "font_family": "Montserrat",
          "font_weight": "700",
          "font_size": "8 vmin",
          "background_color": "rgba(216,216,216,0)",
          "background_x_padding": "26%",
          "background_y_padding": "7%",
          "background_border_radius": "28%",
          "transcript_source": "f18e6afb-3fe5-4ad2-95d4-5050f9b413ba",
          "transcript_effect": "highlight",
          "transcript_placement": "animate",
          "transcript_maximum_length": 25,
          "transcript_color": "#ff0040",
          "fill_color": "#ffffff",
          "stroke_color": "#333333",
          "stroke_width": "1.05 vmin"
        },
*/
