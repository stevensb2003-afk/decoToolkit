// scratch/test_imagen.js
const { genkit } = require('genkit');
const { googleAI } = require('@genkit-ai/google-genai');
require('dotenv').config({ path: '.env.local' });

if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not defined in .env.local');
  process.exit(1);
}

const ai = genkit({
  plugins: [googleAI()],
});

async function main() {
  console.log('Probando generación con googleai/imagen-4.0-generate-001...');
  try {
    const response = await ai.generate({
      model: 'googleai/imagen-4.0-generate-001',
      prompt: 'seamless wood texture, flat lay',
      output: { format: 'media' },
    });

    console.log('Respuesta recibida!');
    console.log('Media:', response.media ? { url: response.media.url.substring(0, 100) + '...' } : 'Ninguno');
  } catch (error) {
    console.error('Error durante la generación:', error);
  }
}

main();
