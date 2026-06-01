// Server-only Genkit flow — detects the 4 physical corners of a material sheet in a photo

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// ---- Output Schema ----
const CornerSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

export const CornersSchema = z.object({
  topLeft:     CornerSchema,
  topRight:    CornerSchema,
  bottomRight: CornerSchema,
  bottomLeft:  CornerSchema,
  confidence:  z.number().min(0).max(1).describe('Confidence score 0-1 of the detection'),
  fallback:    z.boolean().describe('True ONLY if it is a macro flat-lay photo with zero background visible'),
  metadata: z.object({
    materialType: z.string().describe('Ej. WPC Wall Panel, Madera de Roble, Mármol Carrara, etc.'),
    colorPalette: z.array(z.string()).describe('Lista de 2-3 colores principales en formato Hex, ej. ["#3b2f2f", "#4a3c3c"]'),
    pattern: z.string().describe('Ej. Acanalado vertical, vetas marcadas, textura lisa, etc.'),
    finish: z.string().describe('Ej. Mate, brillante, rugoso, etc.'),
    seamlessPrompt: z.string().describe('Hyper-detailed prompt in English for Imagen 4.0 to generate a seamless texture that looks IDENTICAL to the specific material in the photo. Must include: exact color hex codes, wood grain direction, knot locations, stone vein patterns, tile grout width, panel groove depth, any unique imperfections or character marks, surface finish (matte/gloss/satin), the material name/species. Must request: seamless repeating texture, flat lay top-down, neutral even studio lighting, no directional shadows, ultra-realistic 4K photographic quality. The goal is that someone seeing the generated texture should think it is the SAME material as in the photo.')
  }).optional().describe('Material DNA extraction.'),
});

export type CornerDetectionResult = z.infer<typeof CornersSchema>;

// ---- Input Schema ----
const InputSchema = z.object({
  imageBase64: z.string().describe('Base64-encoded image (JPEG or PNG)'),
  mimeType: z.string().default('image/jpeg'),
});

// ---- Genkit Flow ----
export const textureCornerDetector = ai.defineFlow(
  {
    name: 'textureCornerDetector',
    inputSchema: InputSchema,
    outputSchema: CornersSchema,
  },
  async ({ imageBase64, mimeType }) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-2.5-pro',
      output: { schema: CornersSchema },
      prompt: [
        {
          text: `You are an expert computer vision system specialized in detecting the precise boundary of physical material sheets (tiles, laminates, wood panels, stone slabs, wallpaper) in photographs.

TASK: Locate the EXACT 4 corners of the MAIN material sheet and return them as normalized coordinates (0.0=left/top, 1.0=right/bottom).

CRITICAL RULES — READ CAREFULLY:
1. ALWAYS try to find the material sheet. Even if the sheet occupies 90%+ of the frame, there are always subtle visual cues: a thin edge of floor, a hand, a slight color difference, a shadow line, or a depth-of-field change at the border. Search for these.
2. NEVER set fallback=true unless the image is a pure macro flat-lay shot where the material fills 100% of the image with absolutely zero background, zero floor, zero hands, zero shadow edges visible at any border.
3. If the sheet is slightly tilted or in slight perspective, return the actual 4 corner points of the physical sheet, NOT the image boundary.
4. The corners must form a convex quadrilateral. Check: topLeft is top-left relative to the sheet, not the image.
5. For panels leaning against a wall: find the bottom edge on the floor and the top free edge.
6. For sheets flat on a surface: look for the color/material transition at each edge.
7. corner coordinates are RELATIVE to image dimensions, not absolute pixels.
8. confidence: 0.9-1.0 if you can see all 4 edges clearly, 0.6-0.8 if 1-2 edges are cut by the frame, 0.3-0.5 if heavily obscured.

MATERIAL DNA (metadata field):
- Extract detailed visual characteristics of ONLY the material inside the sheet boundary (not the background).
- seamlessPrompt: Be hyper-specific. Mention exact hex colors, wood grain direction (horizontal/vertical), knot frequency, vein color and width for marble, grout color and width for tiles, groove depth for wall panels, surface finish. The prompt must enable Imagen 4.0 to generate a texture that looks IDENTICAL to this specific material.

Return ONLY valid JSON matching the schema. No markdown. No explanations.`,
        },
        { media: { url: `data:${mimeType};base64,${imageBase64}`, contentType: mimeType as 'image/jpeg' | 'image/png' } },
      ],
    });

    if (!output) throw new Error('Gemini returned no output for corner detection');
    return output;
  }
);
