import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Supported aspect ratios by Imagen 4.0
type ImagenAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

/**
 * Picks the closest Imagen 4.0 supported aspect ratio from a real width/height ratio.
 * Maintains portrait/landscape/square orientation.
 */
export function pickAspectRatio(width: number, height: number): ImagenAspectRatio {
  if (width <= 0 || height <= 0) return '1:1';
  const ratio = width / height;
  if (ratio >= 0.9 && ratio <= 1.1) return '1:1';
  if (ratio > 1.1) {
    // Landscape: 4:3 ≈ 1.33, 16:9 ≈ 1.78
    return ratio >= 1.55 ? '16:9' : '4:3';
  }
  // Portrait: 3:4 ≈ 0.75, 9:16 ≈ 0.56
  return ratio <= 0.65 ? '9:16' : '3:4';
}

const InputSchema = z.object({
  prompt: z.string().describe('The hyper-detailed visual prompt for the seamless texture'),
  materialWidth: z.number().optional().describe('Material width in cm'),
  materialHeight: z.number().optional().describe('Material height in cm'),
});

const OutputSchema = z.object({
  base64Image: z.string(),
});

export const textureGeneratorFlow = ai.defineFlow(
  {
    name: 'textureGenerator',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async ({ prompt, materialWidth, materialHeight }) => {
    const aspectRatio = pickAspectRatio(materialWidth ?? 1, materialHeight ?? 1);

    try {
      const response = await ai.generate({
        model: 'googleai/imagen-4.0-generate-001',
        prompt: `Seamless, perfectly tileable surface texture. Flat lay, top-down view, neutral even studio lighting, no directional shadows, no vignette, highly photorealistic 4K quality. The texture must be extracted directly from this reference material and look IDENTICAL to it in color, grain, pattern and finish. Subject: ${prompt}`,
        output: { format: 'media' },
        config: { aspectRatio },
      });

      if (!response.media || !response.media.url) {
        throw new Error('No media returned from model');
      }

      let base64: string;
      if (response.media.url.startsWith('data:')) {
        base64 = response.media.url.split(',')[1];
      } else {
        const fetched = await fetch(response.media.url);
        if (!fetched.ok) throw new Error(`Failed to fetch media URL: ${fetched.status} ${fetched.statusText}`);
        const buffer = await fetched.arrayBuffer();
        base64 = Buffer.from(buffer).toString('base64');
      }

      return { base64Image: base64 };
    } catch (error: any) {
      const status = error?.status ?? error?.code ?? 'unknown';
      console.error(`[textureGeneratorFlow] Error (${status}):`, error.message ?? error);
      throw new Error(`Failed to generate texture [${status}]: ${error.message ?? 'Unexpected error'}`);
    }
  }
);
