import { NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { textureGeneratorFlow } from '@/ai/flows/texture-generator';

export async function POST(req: Request) {
  try {
    // Initialize server auth
    const { auth } = initializeFirebaseAdmin();

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    
    // Verify user
    await auth.verifyIdToken(token);

    const body = await req.json();
    console.log('[POST /api/generate-texture] Request received:', { prompt: body.prompt?.slice(0, 60) });
    if (!body.prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const result = await textureGeneratorFlow(body);
    console.log('[POST /api/generate-texture] Success');
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error?.status ?? error?.code ?? '';
    const is404 = String(status) === '404' || String(error?.message).includes('404');
    console.error(`[POST /api/generate-texture] Error (${status || 'unknown'}):`, error.message ?? error);
    if (is404) {
      return NextResponse.json(
        { error: 'AI model not available. Check your API key permissions or model name.', detail: error.message },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Texture generation failed', detail: String(status) },
      { status: 500 }
    );
  }
}
