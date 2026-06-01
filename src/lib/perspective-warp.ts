/**
 * perspective-warp.ts
 * Applies a perspective warp (homography) from 4 source corners to a flat rectangle.
 * Runs entirely in the browser via HTML5 Canvas. No external dependencies.
 *
 * Algorithm: Inverse Bilinear Interpolation + pixel-by-pixel sampling
 * Sufficient for texture photography (no need for full RANSAC).
 */

export interface Corner { x: number; y: number }

export interface Corners {
  topLeft: Corner;
  topRight: Corner;
  bottomRight: Corner;
  bottomLeft: Corner;
}

/**
 * Solve a 2x2 linear system Ax = b using Cramer's rule.
 */
function solve2x2(
  a00: number, a01: number,
  a10: number, a11: number,
  b0: number, b1: number
): [number, number] {
  const det = a00 * a11 - a01 * a10;
  if (Math.abs(det) < 1e-10) return [0, 0];
  return [(b0 * a11 - b1 * a01) / det, (a00 * b1 - a10 * b0) / det];
}

/**
 * Compute (s, t) in [0,1]x[0,1] for a point (px,py) inside a quadrilateral using
 * inverse bilinear interpolation.
 * The quad is defined by: TL, TR, BR, BL corners (in image pixel coords).
 */
function inverseQuadMap(
  px: number, py: number,
  tl: Corner, tr: Corner, br: Corner, bl: Corner
): [number, number] {
  // f(s,t) = TL*(1-s)*(1-t) + TR*s*(1-t) + BR*s*t + BL*(1-s)*t
  // We solve for s,t iteratively (2 iterations of Newton's method are enough)
  let s = 0.5;
  let t = 0.5;

  for (let iter = 0; iter < 6; iter++) {
    const xs = tl.x*(1-s)*(1-t) + tr.x*s*(1-t) + br.x*s*t + bl.x*(1-s)*t;
    const ys = tl.y*(1-s)*(1-t) + tr.y*s*(1-t) + br.y*s*t + bl.y*(1-s)*t;

    const dxds = -tl.x*(1-t) + tr.x*(1-t) + br.x*t - bl.x*t;
    const dxdt = -tl.x*(1-s) - tr.x*s + br.x*s + bl.x*(1-s);
    const dyds = -tl.y*(1-t) + tr.y*(1-t) + br.y*t - bl.y*t;
    const dydt = -tl.y*(1-s) - tr.y*s + br.y*s + bl.y*(1-s);

    const ex = px - xs;
    const ey = py - ys;

    const [ds, dt] = solve2x2(dxds, dxdt, dyds, dydt, ex, ey);
    s = Math.min(1, Math.max(0, s + ds));
    t = Math.min(1, Math.max(0, t + dt));
  }

  return [s, t];
}

/**
 * Warps the src image using the 4 corners (relative 0-1) and returns a new ImageBitmap
 * with the corrected flat-plane view at the given output size.
 *
 * @param srcBitmap  - Original photo as ImageBitmap
 * @param corners    - Detected corners as relative coords (0-1)
 * @param outWidth   - Output canvas width in pixels
 * @param outHeight  - Output canvas height in pixels
 */
export async function perspectiveWarp(
  srcBitmap: ImageBitmap,
  corners: Corners,
  outWidth = 1024,
  outHeight = 1024,
): Promise<Blob> {
  const srcW = srcBitmap.width;
  const srcH = srcBitmap.height;

  // Convert relative corners to pixel coords
  const tl: Corner = { x: corners.topLeft.x * srcW,     y: corners.topLeft.y * srcH };
  const tr: Corner = { x: corners.topRight.x * srcW,    y: corners.topRight.y * srcH };
  const br: Corner = { x: corners.bottomRight.x * srcW, y: corners.bottomRight.y * srcH };
  const bl: Corner = { x: corners.bottomLeft.x * srcW,  y: corners.bottomLeft.y * srcH };

  // Draw source image to offscreen canvas so we can read pixels
  const srcCanvas = new OffscreenCanvas(srcW, srcH);
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.drawImage(srcBitmap, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH);

  // Create output canvas
  const outCanvas = new OffscreenCanvas(outWidth, outHeight);
  const outCtx = outCanvas.getContext('2d')!;
  const outData = outCtx.createImageData(outWidth, outHeight);

  // For each pixel in output, find its source pixel
  for (let oy = 0; oy < outHeight; oy++) {
    for (let ox = 0; ox < outWidth; ox++) {
      const s = ox / (outWidth - 1);
      const t = oy / (outHeight - 1);

      // Forward map: (s,t) → source pixel coord
      const srcX = tl.x*(1-s)*(1-t) + tr.x*s*(1-t) + br.x*s*t + bl.x*(1-s)*t;
      const srcY = tl.y*(1-s)*(1-t) + tr.y*s*(1-t) + br.y*s*t + bl.y*(1-s)*t;

      const sx = Math.min(srcW - 1, Math.max(0, Math.round(srcX)));
      const sy = Math.min(srcH - 1, Math.max(0, Math.round(srcY)));

      const srcIdx = (sy * srcW + sx) * 4;
      const outIdx = (oy * outWidth + ox) * 4;

      outData.data[outIdx]     = srcData.data[srcIdx];
      outData.data[outIdx + 1] = srcData.data[srcIdx + 1];
      outData.data[outIdx + 2] = srcData.data[srcIdx + 2];
      outData.data[outIdx + 3] = srcData.data[srcIdx + 3];
    }
  }

  outCtx.putImageData(outData, 0, 0);
  return outCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
}

/**
 * Resize an image to fit within maxDimension while preserving aspect ratio.
 * Returns a base64 JPEG string ready to send to the AI.
 */
export async function resizeForAI(
  file: File,
  maxDimension = 1024,
): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxDimension / bitmap.width, maxDimension / bitmap.height);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  const ab = await blob.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
  return { base64: b64, mimeType: 'image/jpeg' };
}
