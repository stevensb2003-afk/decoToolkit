import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

async function test() {
  const envPath = path.join(process.cwd(), '.env.local');
  const env = fs.readFileSync(envPath, 'utf8');
  let credsJson = '';
  const match = env.match(/SERVICE_ACCOUNT_CREDENTIALS='({[\s\S]+?})'/);
  if (match) {
    credsJson = match[1];
  } else {
    const m2 = env.match(/SERVICE_ACCOUNT_CREDENTIALS=({[\s\S]+?})/);
    if (m2) credsJson = m2[1];
  }
  
  if (!credsJson) {
    console.log("No SERVICE_ACCOUNT_CREDENTIALS found");
    return;
  }
  
  const credentials = JSON.parse(credsJson);
  
  const auth = new GoogleAuth({
    credentials,
    scopes: 'https://www.googleapis.com/auth/cloud-platform'
  });
  
  const client = await auth.getClient();
  const projectId = credentials.project_id;
  const accessToken = await client.getAccessToken();
  console.log("Got token for project:", projectId);

  const location = 'us-central1';
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagen-3.0-generate-002:predict`;
  
  const userPrompt = 'Generate an ultra-realistic 4K photographic quality, seamless repeating texture ';
  const promptText = `Clean, seamless, well-lit material texture: ${userPrompt}. Keep the exact same style, but make it uniform, evenly lit, tileable, and remove all lighting artifacts, shadows, and perspective distortions.`;

  const requestBody = {
    instances: [
      { prompt: promptText }
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: "9:16"
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
