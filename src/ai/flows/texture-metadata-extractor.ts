// Server-only Genkit flow — imported only from API routes, never from client bundles

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// ---- Output Schema ----
export const TextureMetadataSchema = z.object({
  suggestedName: z.string().describe('Short material name, e.g. "Roble Natural"'),
  dominantColor: z.string().describe('Most representative hex color of the material, e.g. "#C4956A"'),
  tags: z.array(z.string()).describe('2-4 classification tags, e.g. ["madera", "veteado", "cálido"]'),
  roughness: z.enum(['liso', 'semi-liso', 'texturizado', 'rugoso']).describe('Surface roughness level'),
  hasGrain: z.boolean().describe('True if the material has visible grain or veins (wood, stone)'),
  confidence: z.number().min(0).max(1).describe('Extraction confidence score between 0 and 1'),
});

export type TextureMetadata = z.infer<typeof TextureMetadataSchema>;

// ---- Input Schema ----
const InputSchema = z.object({
  imageUrl: z.string().url(),
  materialWidthCm: z.number().positive(),
  materialHeightCm: z.number().positive(),
});

// ---- Genkit Flow ----
export const textureMetadataExtractor = ai.defineFlow(
  {
    name: 'textureMetadataExtractor',
    inputSchema: InputSchema,
    outputSchema: TextureMetadataSchema,
  },
  async ({ imageUrl, materialWidthCm, materialHeightCm }) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      output: { schema: TextureMetadataSchema },
      prompt: [
        {
          text: `Analyze this material texture photo. The physical sheet is ${materialWidthCm}cm wide x ${materialHeightCm}cm tall.
Extract:
1. A short descriptive name in Spanish (e.g. "Roble Natural", "Mármol Calacatta")
2. The single most representative hex color of the material
3. 2-4 classification tags in Spanish lowercase (material type, pattern, tone)
4. Surface roughness: liso | semi-liso | texturizado | rugoso
5. Whether it has visible grain or veins (wood grain, stone veins)
6. Your confidence score (0-1) in this analysis

Respond ONLY with the JSON schema. No markdown, no explanations.`,
        },
        { media: { url: imageUrl, contentType: 'image/jpeg' } },
      ],
    });

    if (!output) throw new Error('Genkit returned no output for texture extraction');
    return output;
  }
);
