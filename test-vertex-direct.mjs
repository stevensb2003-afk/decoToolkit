import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';

async function test() {
  console.log("Initializing auth...");
  const auth = new GoogleAuth({
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
  });
  const client = await auth.getClient();
  const projectId = await auth.getProjectId();
  const accessToken = await client.getAccessToken();
  console.log("Got token for project:", projectId);

  const location = 'us-central1';
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;
  
  const requestBody = {
    instances: [
      {
        prompt: "Generate an ultra-realistic 4K photographic quality, seamless repeating texture of wood"
      }
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1"
    }
  };

  console.log("Calling URL:", url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken.token}`,
    },
    body: JSON.stringify(requestBody),
  });

  console.log("Status:", response.status, response.statusText);
  const text = await response.text();
  console.log("Raw Body:", text.substring(0, 500) + (text.length > 500 ? "..." : ""));
}

test().catch(console.error);
