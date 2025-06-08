import { z } from 'zod';

/* {
  "id": "69ba407b-72a9-4050-a9fb-559827b9623d",
  "status": "succeeded",
  "url": "https://cdn.creatomate.com/renders/69ba407b-72a9-4050-a9fb-559827b9623d.mp4",
  "snapshot_url": "https://cdn.creatomate.com/snapshots/69ba407b-72a9-4050-a9fb-559827b9623d.jpg",
  "template_id": "9e90d011-52e6-49dc-8a7a-5f25058c2568",
  "template_name": "Your Template Name",
  "template_tags": [],
  "output_format": "mp4",
  "render_scale": 1,
  "width": 720,
  "height": 900,
  "frame_rate": 60,
  "duration": 15.5,
  "file_size": 751089
} */

export const CreatomateRenderResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  url: z.string(),
  snapshot_url: z.string(),
  template_id: z.string(),
  template_name: z.string(),
});

export type CreatomateRenderResponse = z.infer<
  typeof CreatomateRenderResponseSchema
>;
