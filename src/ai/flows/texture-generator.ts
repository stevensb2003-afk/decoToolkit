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
        model: 'googleai/imagen-3.0-generate-002',
        prompt: `Create a seamless, perfectly tileable texture. Flat lay, top-down view, neutral even lighting with no directional shadows, highly realistic 4K. Subject: ${prompt}`,
        output: { format: 'media' },
      });

      // Genkit returns media URL usually as a data URI for images
      if (!response.media || !response.media.url) {
        throw new Error('No media returned from model');
      }

      let base64 = response.media.url;
      // Strip 'data:image/png;base64,' if present
      if (base64.startsWith('data:')) {
        base64 = base64.split(',')[1];
      }

      return { base64Image: base64 };
    } catch (error: any) {
      console.error('Texture Generation Error:', error);
      throw new Error(`Failed to generate texture: ${error.message}`);
    }
  }
);
