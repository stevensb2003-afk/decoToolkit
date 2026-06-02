import { GoogleAuth } from 'google-auth-library';
import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Supported aspect ratios by Imagen 3.0
type ImagenAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

/**
 * Picks the closest Imagen 3.0 supported aspect ratio from a real width/height ratio.
 */
export function pickAspectRatio(width: number, height: number): ImagenAspectRatio {
  if (width <= 0 || height <= 0) return '1:1';
  const ratio = width / height;
  if (ratio >= 0.9 && ratio <= 1.1) return '1:1';
  if (ratio > 1.1) {
    return ratio >= 1.55 ? '16:9' : '4:3';
  }
  return ratio <= 0.65 ? '9:16' : '3:4';
}

const InputSchema = z.object({
  prompt: z.string().describe('The visual prompt for the seamless texture'),
  materialWidth: z.number().optional().describe('Material width in cm'),
  materialHeight: z.number().optional().describe('Material height in cm'),
  imageBase64: z.string().describe('Base64 of the cropped reference image to edit'),
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
  async ({ prompt, materialWidth, materialHeight, imageBase64 }) => {
    const aspectRatio = pickAspectRatio(materialWidth ?? 1, materialHeight ?? 1);

    try {
      // 1. Authenticate with Google Cloud securely (works in local via JSON and in App Hosting via ADC)
      const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
      });
      const client = await auth.getClient();
      const projectId = process.env.GCP_PROJECT_ID || (await auth.getProjectId());
      const location = process.env.GCP_LOCATION || 'us-central1';

      // 2. Fetch the OAuth access token
      const accessToken = await client.getAccessToken();
      if (!accessToken.token) {
        throw new Error('Failed to retrieve Google Cloud access token');
      }

      // 3. Make direct REST call to Vertex AI Imagen 3.0 Capability Model for true Image-to-Image editing
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-capability-001:predict`;

      const requestBody = {
        instances: [
          {
            image: {
              bytesBase64Encoded: imageBase64,
            },
            prompt: `Seamless, perfectly tileable surface texture. Make the lighting perfectly flat, even, and homogeneous. Remove all directional shadows, hot-spots, and glare. Preserve the grain, color, and pattern structure of the original image, highly realistic 4K. Subject: ${prompt}`,
          },
        ],
        parameters: {
          editConfig: {
            editMode: 'EDIT_MODE_DEFAULT',
            imageStrength: 0.75, // Conserves 75% of original texture grains while allowing 25% change to clean shadows & make seamless
          },
          aspectRatio,
          outputMimeType: 'image/jpeg',
        },
      };

      console.log(`[textureGeneratorFlow] Calling Vertex AI REST API for True Image-to-Image (Project: ${projectId})`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Vertex AI API returned error: ${response.status} ${response.statusText} - ${errText}`);
      }

      const responseBody = await response.json();
      if (!responseBody.predictions || responseBody.predictions.length === 0) {
        throw new Error('No predictions returned from Vertex AI capability model');
      }

      const generatedBase64 = responseBody.predictions[0].bytesBase64Encoded;
      return { base64Image: generatedBase64 };
    } catch (error: any) {
      console.error('[textureGeneratorFlow] Error during Image-to-Image prediction:', error.message ?? error);
      throw new Error(`Failed to generate texture [Image-to-Image]: ${error.message ?? 'Unexpected error'}`);
    }
  }
);
