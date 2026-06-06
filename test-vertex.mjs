import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

async function testVertexAI() {
  try {
    // 1. Cargar variables de entorno locales de .env.local de forma manual
    const envPath = path.join(process.cwd(), '.env.local');
    const envFile = fs.readFileSync(envPath, 'utf8');
    const credentialsMatch = envFile.match(/SERVICE_ACCOUNT_CREDENTIALS='([\s\S]*?)'/);
    
    if (!credentialsMatch) {
      throw new Error("No se encontró SERVICE_ACCOUNT_CREDENTIALS en .env.local");
    }

    const credentials = JSON.parse(credentialsMatch[1]);
    console.log("Autenticando como:", credentials.client_email);

    // 2. Autenticar con GCP
    const auth = new GoogleAuth({
      credentials,
      scopes: 'https://www.googleapis.com/auth/cloud-platform',
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();
    const projectId = "studio-8456615389-4bf0d";
    const location = "us-central1";

    console.log("Token obtenido. Probando Vertex AI (gemini-1.5-flash-002)...");

    // 3. Probar un modelo básico de texto en Vertex AI
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-1.5-flash-002:generateContent`;
    
    const requestBody = {
      contents: [{ role: "user", parts: [{ text: "Hola, ¿funcionas?" }] }]
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
    
    if (!response.ok) {
      console.error("\n❌ ERROR DE VERTEX AI (Gemini Flash):", JSON.stringify(result, null, 2));
    } else {
      console.log("\n✅ ÉXITO VERTEX AI (Gemini Flash):", result.candidates[0].content.parts[0].text);
    }

  } catch (error) {
    console.error("Error en el script:", error);
  }
}

testVertexAI();
