import { Corners, perspectiveWarp } from '@/lib/perspective-warp';
import { getAuth } from 'firebase/auth';

export async function rotateBlob90(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.height;
  canvas.height = bitmap.width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((90 * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => { if (b) resolve(b); else reject(new Error('Canvas toBlob failed')); }, 'image/jpeg', 0.95);
  });
}

export async function warpImage(
  file: File,
  corners: Corners,
  materialWidth: number,
  materialHeight: number,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const ratio = materialWidth / materialHeight;
  const outW = ratio >= 1 ? 1024 : Math.round(1024 * ratio);
  const outH = ratio >= 1 ? Math.round(1024 / ratio) : 1024;
  const blob = await perspectiveWarp(bitmap, corners, outW, outH);
  bitmap.close();
  return blob;
}

export async function fetchAiTexture(seamlessPrompt: string): Promise<Blob> {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const token = await user.getIdToken();
  const res = await fetch('/api/generate-texture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prompt: seamlessPrompt }),
  });
  if (!res.ok) throw new Error('Error de generación');
  const { base64Image } = await res.json();
  const byteCharacters = atob(base64Image);
  const bytes = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) bytes[i] = byteCharacters.charCodeAt(i);
  return new Blob([bytes], { type: 'image/jpeg' });
}
