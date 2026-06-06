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

    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-capability-001:predict`;
    
    // Tiny valid 1x1 base64 png
    const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    const requestBody = {
      instances: [
        {
          prompt: "make it blue",
          contextImage: {
            bytesBase64Encoded: tinyPng
          }
        }
      ],
      parameters: {
        sampleCount: 1,
        editConfig: {
            editMode: "EDIT_MODE_DEFAULT"
        }
      }
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
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error("Error:", error);
  }
}
testVertexAI();
