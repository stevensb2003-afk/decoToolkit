import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { textureCornerDetector } from '@/ai/flows/texture-corner-detector';

if (!process.env.GEMINI_API_KEY) {
  console.error('[detect-corners] GEMINI_API_KEY is not set.');
}

// In-memory rate limit: 20 req/user/min
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(uid);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count++;
  return true;
}

// Max image size for AI: 4 MB base64 → ~3 MB binary
const MAX_B64_CHARS = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // 1. Auth
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.slice(7);

  let uid: string;
  try {
    const { auth } = initializeFirebaseAdmin();
    const decoded = await auth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  if (!checkRateLimit(uid)) {
    return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  }

  // 2. Parse body
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { imageBase64, mimeType } = body as Record<string, unknown>;

  if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
    return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
  }
  if (imageBase64.length > MAX_B64_CHARS) {
    return NextResponse.json({ error: 'Image too large. Please resize before sending.' }, { status: 413 });
  }

  // 3. Run Genkit flow
  try {
    const result = await textureCornerDetector({
      imageBase64,
      mimeType: typeof mimeType === 'string' ? mimeType : 'image/jpeg',
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[detect-corners] Genkit error:', message);
    return NextResponse.json({ error: 'AI detection failed', detail: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
