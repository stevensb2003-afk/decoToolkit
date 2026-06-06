import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

async function testVertexAI() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    const credentialsMatch = envFile.match(/SERVICE_ACCOUNT_CREDENTIALS='([\s\S]*?)'/);
    const credentials = JSON.parse(credentialsMatch[1]);
    const auth = new GoogleAuth({ credentials, scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const projectId = "studio-8456615389-4bf0d";
    const location = "us-central1";

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;

    const requestBody = {
      instances: [
        {
          prompt: "Clean, seamless, well-lit material texture: Generate an ultra-realistic 4K photographic quality seamless repeating texture of wood. Keep the exact same style, but make it uniform, evenly lit, tileable, and remove all lighting artifacts, shadows, and perspective distortions.",
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "9:16",
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken.token}`,
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    if (result.predictions) {
      console.log("Got predictions:", result.predictions.length);
    } else {
      console.log("No predictions. Result:", JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error("Error:", error);
  }
}
testVertexAI();
