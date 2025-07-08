import { z } from "zod";

// Base element (common properties)
const BaseElement = z.object({
  id: z.string().optional(),
  type: z.string(),
  track: z.number().optional(),
  time: z.number().optional(),
  duration: z.union([z.number(), z.string(), z.null()]).optional(),
  x_alignment: z.string().optional(),
  y_alignment: z.string().optional(),
  width: z.union([z.string(), z.number(), z.null()]).optional(),
  height: z.union([z.string(), z.number(), z.null()]).optional(),
  volume: z.union([z.number(), z.string(), z.null()]).optional(),
  // ... autres propriétés communes si besoin
});

// Forward declarations for recursive types
let Element: z.ZodTypeAny;
let ElementArray: z.ZodTypeAny;

// Video element
const VideoElement = BaseElement.extend({
  type: z.literal("video"),
  source: z.string(),
  fit: z.string().optional(),
  // ... autres propriétés spécifiques vidéo
});

// Audio element
const AudioElement = BaseElement.extend({
  type: z.literal("audio"),
  source: z.string(), // C'est ici qu'on vérifie que ce n'est PAS 'text'
  provider: z.string().optional(),
  dynamic: z.boolean().optional(),
  // ... autres propriétés spécifiques audio
});

// Text element
const TextElement = BaseElement.extend({
  type: z.literal("text"),
  text: z.string().optional(), // Peut être utilisé pour du texte statique
  transcript_source: z.string().optional(),
  transcript_effect: z.string().optional(),
  transcript_maximum_length: z.number().optional(),
  font_family: z.string().optional(),
  font_weight: z.string().optional(),
  font_size: z.string().optional(),
  fill_color: z.string().optional(),
  stroke_color: z.string().optional(),
  background_color: z.string().optional(),
  // ... autres propriétés spécifiques texte
});

// Composition element (peut contenir d'autres éléments)
const CompositionElement = BaseElement.extend({
  type: z.literal("composition"),
  elements: z.lazy(() => ElementArray),
});

// Définition de l'union après déclaration de toutes les variantes
Element = z.discriminatedUnion("type", [
  VideoElement,
  AudioElement,
  TextElement,
  CompositionElement,
]);
ElementArray = z.array(Element);

// Template Creatomate principal
export const CreatomateTemplateSchema = z.object({
  output_format: z.literal("mp4"),
  width: z
    .number()
    .int()
    .refine((v) => v === 1080, {
      message: "Width must be 1080 for vertical video.",
    }),
  height: z
    .number()
    .int()
    .refine((v) => v === 1920, {
      message: "Height must be 1920 for vertical video.",
    }),
  elements: ElementArray,
});

export type CreatomateTemplate = z.infer<typeof CreatomateTemplateSchema>;
