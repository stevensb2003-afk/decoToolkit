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
    if (!body.prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const result = await textureGeneratorFlow(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API /api/generate-texture error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}
