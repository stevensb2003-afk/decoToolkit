"use server";

import { randomUUID } from "crypto";
import { initializeFirebaseAdmin } from "@/firebase/server";
import type { MaterialTexture } from "@/lib/types";

const BUCKET = "studio-8456615389-4bf0d.firebasestorage.app";
const MAX_SIZE = 15 * 1024 * 1024;

function getStorage() {
  return initializeFirebaseAdmin().storage;
}

function buildDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

async function uploadToStorage(
  storagePath: string,
  file: File
): Promise<{ url: string; storagePath: string }> {
  const adminStorage = getStorage();
  const bucket = adminStorage.bucket(BUCKET);
  const fileRef = bucket.file(storagePath);
  const buffer = Buffer.from(await file.arrayBuffer());
  const token = randomUUID();
  await fileRef.save(buffer, {
    contentType: file.type,
    resumable: false,
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = buildDownloadUrl(bucket.name, storagePath, token);
  return { url, storagePath };
}

function buildTexture(url: string, storagePath: string, metadata?: any): MaterialTexture {
  return {
    url,
    storagePath,
    originalWidth: 0,
    originalHeight: 0,
    uploadedAt: new Date() as any,
    ...(metadata ? { metadata } : {})
  };
}

function validateFile(
  file: File | null
): { valid: true } | { valid: false; error: string } {
  if (!file || !file.type.startsWith("image/"))
    return { valid: false, error: "Archivo inválido." };
  if (file.size > MAX_SIZE)
    return { valid: false, error: "El archivo supera los 15 MB." };
  return { valid: true };
}

// ─── Default Material Textures ────────────────────────────────────────────────

export async function uploadDefaultTextureAction(
  materialId: string,
  formData: FormData
): Promise<{ success: true; texture: MaterialTexture } | { success: false; error: string }> {
  const file = formData.get("file") as File | null;
  const metadataStr = formData.get("metadata") as string | null;
  let metadata: any = undefined;
  if (metadataStr) {
    try { metadata = JSON.parse(metadataStr); } catch (e) {}
  }
  
  const validation = validateFile(file);
  if (!validation.valid) return { success: false, error: validation.error };

  const storagePath = `textures/default/${materialId}_${Date.now()}.jpg`;
  try {
    const { url } = await uploadToStorage(storagePath, file!);
    return { success: true, texture: buildTexture(url, storagePath, metadata) };
  } catch (error: any) {
    console.error("Error uploading default texture:", error);
    return { success: false, error: error.message || "Error al subir la textura." };
  }
}

export async function deleteDefaultTextureAction(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  if (!storagePath) return { success: false, error: "Path inválido." };
  try {
    const adminStorage = getStorage();
    await adminStorage.bucket(BUCKET).file(storagePath).delete({ ignoreNotFound: true });
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting default texture:", error);
    return { success: false, error: error.message || "Error al eliminar la textura." };
  }
}

// ─── Project Material Textures ────────────────────────────────────────────────

export async function uploadProjectTextureAction(
  projectId: string,
  materialId: string,
  formData: FormData
): Promise<{ success: true; texture: MaterialTexture } | { success: false; error: string }> {
  const file = formData.get("file") as File | null;
  const metadataStr = formData.get("metadata") as string | null;
  let metadata: any = undefined;
  if (metadataStr) {
    try { metadata = JSON.parse(metadataStr); } catch (e) {}
  }
  
  const validation = validateFile(file);
  if (!validation.valid) return { success: false, error: validation.error };

  const storagePath = `textures/projects/${projectId}/${materialId}_${Date.now()}.jpg`;
  try {
    const { url } = await uploadToStorage(storagePath, file!);
    return { success: true, texture: buildTexture(url, storagePath, metadata) };
  } catch (error: any) {
    console.error("Error uploading project texture:", error);
    return { success: false, error: error.message || "Error al subir la textura." };
  }
}

export async function deleteProjectTextureAction(
  storagePath: string
): Promise<{ success: boolean; error?: string }> {
  if (!storagePath) return { success: false, error: "Path inválido." };
  try {
    const adminStorage = getStorage();
    await adminStorage.bucket(BUCKET).file(storagePath).delete({ ignoreNotFound: true });
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting project texture:", error);
    return { success: false, error: error.message || "Error al eliminar la textura." };
  }
}
