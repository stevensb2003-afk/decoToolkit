import { NextRequest, NextResponse } from 'next/server';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { textureMetadataExtractor } from '@/ai/flows/texture-metadata-extractor';

// Guard: ensure GEMINI_API_KEY is set at module load (server-only)
if (!process.env.GEMINI_API_KEY) {
  console.error('[extract-texture-metadata] GEMINI_API_KEY is not set. AI features will fail.');
}

// ---- Rate limit: max 30 req/user/min (in-memory, resets per cold start) ----
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(uid: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(uid);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ---- POST /api/extract-texture-metadata ----
export async function POST(req: NextRequest) {
  // 1. Verify Firebase Auth token — blocks unauthenticated requests
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

  // 2. Rate limit per authenticated user
  if (!checkRateLimit(uid)) {
    return NextResponse.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  }

  // 3. Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { imageUrl, materialWidthCm, materialHeightCm } = body as Record<string, unknown>;

  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('https://')) {
    return NextResponse.json({ error: 'imageUrl must be a valid HTTPS URL' }, { status: 400 });
  }
  if (typeof materialWidthCm !== 'number' || materialWidthCm <= 0) {
    return NextResponse.json({ error: 'materialWidthCm must be a positive number' }, { status: 400 });
  }
  if (typeof materialHeightCm !== 'number' || materialHeightCm <= 0) {
    return NextResponse.json({ error: 'materialHeightCm must be a positive number' }, { status: 400 });
  }

  // 4. Run Genkit flow — GEMINI_API_KEY is consumed server-side only
  try {
    const metadata = await textureMetadataExtractor({
      imageUrl,
      materialWidthCm,
      materialHeightCm,
    });
    return NextResponse.json(metadata, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[extract-texture-metadata] Genkit error:', message);
    return NextResponse.json({ error: 'AI extraction failed', detail: message }, { status: 500 });
  }
}

// Block all other methods
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
