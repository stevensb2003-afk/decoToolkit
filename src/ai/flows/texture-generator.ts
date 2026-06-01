import { ai } from '@/ai/genkit';
import { z } from 'zod';

const InputSchema = z.object({
  prompt: z.string().describe('The prompt for generating the seamless texture'),
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
  async ({ prompt }) => {
    try {
      const response = await ai.generate({
        model: 'googleai/imagen-4.0-generate-001',
        prompt: `Create a seamless, perfectly tileable texture. Flat lay, top-down view, neutral even lighting with no directional shadows, highly realistic 4K. Subject: ${prompt}`,
        output: { format: 'media' },
      });

      // Genkit returns media URL usually as a data URI for images
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
