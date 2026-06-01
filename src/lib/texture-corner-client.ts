/**
 * texture-corner-client.ts
 * Client-side helper to call the /api/detect-corners endpoint.
 * Shared between DefaultMaterialTextureUploader and TextureUploader.
 */

import { getAuth } from 'firebase/auth';
import type { Corners } from '@/lib/perspective-warp';

export interface CornerDetectionResult {
  corners?: Corners;
  metadata?: any;
  fallback?: boolean;
}

export const FULL_IMAGE_CORNERS: Corners = {
  topLeft:     { x: 0, y: 0 },
  topRight:    { x: 1, y: 0 },
  bottomRight: { x: 1, y: 1 },
  bottomLeft:  { x: 0, y: 1 },
};

/**
 * Calls /api/detect-corners with the given base64 image.
 * Returns the raw API response or null on auth failure / network error.
 */
export async function detectCornersFromBase64(
  base64: string,
  mimeType: string,
): Promise<CornerDetectionResult | null> {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) return null;
    const token = await user.getIdToken();

    const res = await fetch('/api/detect-corners', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Resolves detected corners from an API result.
 * Returns detected corners if valid, otherwise falls back to full-image corners.
 */
export function resolveCorners(result: CornerDetectionResult | null): Corners {
  if (result && !result.fallback && result.corners) return result.corners;
  return FULL_IMAGE_CORNERS;
}
