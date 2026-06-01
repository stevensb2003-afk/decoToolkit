// Server-only Genkit flow — detects the 4 physical corners of a material sheet in a photo

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// ---- Output Schema ----
// Corners in clockwise order starting from top-left, coordinates 0.0 - 1.0 relative to image
const CornerSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });

export const CornersSchema = z.object({
  topLeft:     CornerSchema,
  topRight:    CornerSchema,
  bottomRight: CornerSchema,
  bottomLeft:  CornerSchema,
  confidence:  z.number().min(0).max(1).describe('Confidence score 0-1 of the detection'),
  fallback:    z.boolean().describe('True if the full image should be used because no distinct sheet was found'),
  metadata: z.object({
    materialType: z.string().describe('Ej. WPC Wall Panel, Madera de Roble, Mármol Carrara, etc.'),
    colorPalette: z.array(z.string()).describe('Lista de 2-3 colores principales en formato Hex, ej. ["#3b2f2f", "#4a3c3c"]'),
    pattern: z.string().describe('Ej. Acanalado vertical, vetas marcadas, textura lisa, etc.'),
    finish: z.string().describe('Ej. Mate, brillante, rugoso, etc.'),
    seamlessPrompt: z.string().describe('Un prompt detallado en inglés, listo para enviarse a Imagen 3 o Midjourney para que genere una textura seamless de este material. Debe pedir explícitamente "seamless texture", vista top-down (flat lay), iluminación neutra sin sombras direccionales.')
  }).optional().describe('Extracción de ADN del material.')
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
          text: `You are a computer vision expert. The user has taken a photo of a material sheet (tile, laminate, wood panel, etc.) to use as a texture in a design app.

Your task: Find the 4 corners of the MAIN material sheet in this photo.

Rules:
- Return corners as relative coordinates (0.0 = left/top, 1.0 = right/bottom) of the image.
- Order: topLeft, topRight, bottomRight, bottomLeft (clockwise).
- If the sheet fills the entire frame or you cannot distinguish it from the background, set fallback=true and return the full image corners: {0,0}, {1,0}, {1,1}, {0,1}.
- confidence: 1.0 if you are very sure, 0.3 if the sheet is hard to separate from background.
- Extrae el ADN del material en el objeto "metadata". Eres un experto en diseño de interiores. Describe el material físico que está dentro de ese recorte.
- Respond ONLY with the JSON. No markdown, no explanations.`,
        },
        { media: { url: `data:${mimeType};base64,${imageBase64}`, contentType: mimeType as 'image/jpeg' | 'image/png' } },
      ],
    });

    if (!output) throw new Error('Gemini returned no output for corner detection');
    return output;
  }
);
