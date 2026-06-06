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
      // 1. Authenticate with Google Cloud securely
      let authOptions: any = {
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
      };
      
      // Use the proper Firebase service account instead of the stray gcp-key.json
      if (process.env.SERVICE_ACCOUNT_CREDENTIALS) {
        authOptions.credentials = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS);
      }

      const auth = new GoogleAuth(authOptions);
      const client = await auth.getClient();
      
      const projectId = process.env.GCP_PROJECT_ID || (await auth.getProjectId());
      const location = process.env.GCP_LOCATION || 'us-central1';

      // 2. Fetch the OAuth access token
      const accessToken = await client.getAccessToken();
      if (!accessToken.token) {
        throw new Error('Failed to retrieve Google Cloud access token');
      }

      // Log the credentials being used for debugging IAM
      try {
        const credentials = await auth.getCredentials();
        console.log(`[textureGeneratorFlow] Authenticated as: ${credentials?.client_email} for project: ${projectId}`);
      } catch (e) {
        console.log(`[textureGeneratorFlow] Could not retrieve client_email:`, e);
      }

      // 3. Make direct REST call to Vertex AI Imagen 3 (imagen-3.0-generate-002) for Text-to-Image generation
      // Usamos el prompt súper detallado que generó Gemini Vision a partir de tu foto, para generar una textura seamless perfecta.
      const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;

      const promptText = `A clean, seamless, tileable material texture of: ${prompt}. High quality, uniform lighting, no shadows.`;

      const requestBody = {
        instances: [
          {
            prompt: promptText,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio,
        },
      };

      console.log(`[textureGeneratorFlow] Calling Vertex AI REST API for Text-to-Image generation (Project: ${projectId})`);
      let responseBody;
      let rawText = '';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          Authorization: `Bearer ${accessToken.token}`,
        },
        body: JSON.stringify(requestBody),
        cache: 'no-store',
      });

      if (response.ok) {
        rawText = await response.text();
        try { responseBody = JSON.parse(rawText); } catch(e) { responseBody = {}; }
      } else {
        const errText = await response.text();
        throw new Error(`Vertex AI API returned error: ${response.status} ${response.statusText} - ${errText}`);
      }

      // FALLBACK TO IMAGEN 3 GENERATE 001 IF 002 SILENTLY FAILS OR BLOCKS
      if (!responseBody.predictions || responseBody.predictions.length === 0) {
        console.warn("[textureGeneratorFlow] ⚠️ Imagen 3 (002) returned empty predictions. Raw:", rawText);
        console.log(`[textureGeneratorFlow] Retrying with Imagen 3 (001) with 1:1 aspect ratio...`);
        
        const fallbackUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-001:predict`;
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            Authorization: `Bearer ${accessToken.token}`,
          },
          body: JSON.stringify({
            instances: [
              { prompt: `Seamless tileable material texture: ${prompt}` }
            ],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1", // Fallback a 1:1 por si la relación de aspecto estaba causando problemas
            }
          }),
          cache: 'no-store',
        });

        if (!fallbackResponse.ok) {
          const errText = await fallbackResponse.text();
          throw new Error(`Fallback Imagen 3 (001) API returned error: ${fallbackResponse.status} ${fallbackResponse.statusText} - ${errText}`);
        }

        const fallbackRawText = await fallbackResponse.text();
        try { responseBody = JSON.parse(fallbackRawText); } catch(e) { responseBody = {}; }

        if (!responseBody.predictions || responseBody.predictions.length === 0) {
          throw new Error(`No predictions returned from Vertex AI model even after fallback. Raw response: ${fallbackRawText}`);
        }
      }

      const generatedBase64 = responseBody.predictions[0].bytesBase64Encoded;
      return { base64Image: generatedBase64 };
    } catch (error: any) {
      console.error('[textureGeneratorFlow] Error during Text-to-Image prediction:', error.message ?? error);
      throw new Error(`Failed to generate texture [Text-to-Image]: ${error.message ?? 'Unexpected error'}`);
    }
  }
);
