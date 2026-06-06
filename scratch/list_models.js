// scratch/list_models.js
require('dotenv').config({ path: '.env.local' });

if (!process.env.GEMINI_API_KEY) {
  console.error('Error: GEMINI_API_KEY is not defined in .env.local');
  process.exit(1);
}

async function main() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;
  try {
    console.log('Listando modelos con fetch nativo...');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log('Modelos disponibles:');
    for (const model of data.models) {
      if (model.name.includes('imagen') || model.name.includes('gemini')) {
        console.log(`- ${model.name} (Soporta: ${model.supportedGenerationMethods.join(', ')})`);
      }
    }
  } catch (error) {
    console.error('Error listando modelos:', error);
  }
}

main();
