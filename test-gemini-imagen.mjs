import fs from 'fs';
import path from 'path';

async function test() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envFile = fs.readFileSync(envPath, 'utf8');
  const keyMatch = envFile.match(/GEMINI_API_KEY=([^\s]+)/);
  if (!keyMatch) {
    console.log("No key found");
    return;
  }
  const key = keyMatch[1];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${key}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: 'a cat' }],
      parameters: { sampleCount: 1 }
    })
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.json());
}
test();
