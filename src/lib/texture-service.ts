import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import type { MaterialTexture } from '@/lib/types';

export async function uploadMaterialTexture(
  file: File,
  projectId: string,
  materialId: string,
  storage: FirebaseStorage
): Promise<MaterialTexture> {
  const path = `textures/projects/${projectId}/${materialId}_${Date.now()}.jpg`;
  const storageRef = ref(storage, path);

  let originalWidth = 0;
  let originalHeight = 0;
  try {
    const bitmap = await createImageBitmap(file);
    originalWidth = bitmap.width;
    originalHeight = bitmap.height;
    bitmap.close();
  } catch {
    // Non-fatal — dimensions remain 0
  }

  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);

  return {
    url,
    storagePath: path,
    originalWidth,
    originalHeight,
    uploadedAt: Timestamp.now(),
  };
}

export async function uploadDefaultMaterialTexture(
  file: File,
  materialId: string,
  storage: FirebaseStorage
): Promise<MaterialTexture> {
  const path = `textures/default/${materialId}_${Date.now()}.jpg`;
  const storageRef = ref(storage, path);

  let originalWidth = 0;
  let originalHeight = 0;
  try {
    const bitmap = await createImageBitmap(file);
    originalWidth = bitmap.width;
    originalHeight = bitmap.height;
    bitmap.close();
  } catch {
    // Non-fatal
  }

  await uploadBytes(storageRef, file, { contentType: file.type });
  const url = await getDownloadURL(storageRef);

  return {
    url,
    storagePath: path,
    originalWidth,
    originalHeight,
    uploadedAt: Timestamp.now(),
  };
}

export async function deleteMaterialTexture(
  storagePath: string,
  storage: FirebaseStorage
): Promise<void> {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}
