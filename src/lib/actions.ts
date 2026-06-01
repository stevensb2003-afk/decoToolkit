
"use server";

import { revalidatePath } from "next/cache";
import type { Unit, MaterialTexture } from "@/lib/types";
import { z } from "zod";
import { convertToCm } from "./utils";
import { initializeFirebaseAdmin } from "@/firebase/server";

const { firestore: db } = initializeFirebaseAdmin();

// ─── Shared Schemas ──────────────────────────────────────────────────────────

const DimensionInputSchema = z.object({
  value: z.coerce.number().positive("El valor debe ser positivo"),
  unit: z.enum(["m", "cm"]),
});

const MaterialTextureSchema = z.object({
  url: z.string().url(),
  storagePath: z.string().min(1),
  originalWidth: z.number(),
  originalHeight: z.number(),
  uploadedAt: z.any(),
});

const DefaultMaterialFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  width: DimensionInputSchema,
  height: DimensionInputSchema,
  color: z.string().optional(),
  categoryId: z.string().optional(),
});

const CategoryFormSchema = z.object({
  name: z.string().min(1, "El nombre de la categoría es requerido"),
  description: z.string().optional(),
  order: z.coerce.number().default(0),
});

// ─── Material Categories CRUD ─────────────────────────────────────────────────

export async function createMaterialCategory(formData: unknown) {
  const result = CategoryFormSchema.safeParse(formData);
  if (!result.success) return { success: false, error: "Datos de categoría inválidos." };

  const { name, description, order } = result.data;

  try {
    await db.collection("materialCategories").add({
      name,
      description: description || "",
      order,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating material category:", error);
    return { success: false, error: error.message || "Error al crear la categoría." };
  }
}

export async function updateMaterialCategory(id: string, formData: unknown) {
  const result = CategoryFormSchema.safeParse(formData);
  if (!result.success) return { success: false, error: "Datos de categoría inválidos." };

  const { name, description, order } = result.data;

  try {
    await db.collection("materialCategories").doc(id).update({
      name,
      description: description || "",
      order,
      updatedAt: new Date(),
    });
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating material category:", error);
    return { success: false, error: error.message || "Error al actualizar la categoría." };
  }
}

export async function deleteMaterialCategory(id: string) {
  try {
    await db.collection("materialCategories").doc(id).delete();
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting material category:", error);
    return { success: false, error: error.message || "Error al eliminar la categoría." };
  }
}

// ─── Default Materials CRUD ───────────────────────────────────────────────────

export async function createDefaultMaterial(formData: unknown) {
  const result = DefaultMaterialFormSchema.safeParse(formData);
  if (!result.success) return { success: false, error: "Error de validación en el formulario." };

  const { name, width, height, color, categoryId } = result.data;

  try {
    const payload: Record<string, unknown> = {
      name,
      width: convertToCm(width.value, width.unit),
      height: convertToCm(height.value, height.unit),
      createdAt: new Date(),
    };
    if (color) payload.color = color;
    if (categoryId) payload.categoryId = categoryId;

    await db.collection("defaultMaterials").add(payload);
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating default material:", error);
    return { success: false, error: error.message || "Error al crear el material estándar." };
  }
}

export async function updateDefaultMaterial(id: string, formData: unknown) {
  const result = DefaultMaterialFormSchema.safeParse(formData);
  if (!result.success) return { success: false, error: "Error de validación en el formulario." };

  const { name, width, height, color, categoryId } = result.data;

  try {
    const payload: Record<string, unknown> = {
      name,
      width: convertToCm(width.value, width.unit),
      height: convertToCm(height.value, height.unit),
    };
    if (color !== undefined) payload.color = color;
    if (categoryId !== undefined) payload.categoryId = categoryId;

    await db.collection("defaultMaterials").doc(id).update(payload);
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating default material:", error);
    return { success: false, error: error.message || "Error al actualizar el material estándar." };
  }
}

// ─── Texture Management (Firestore refs) ──────────────────────────────────────

export async function updateDefaultMaterialTexture(id: string, texture: unknown) {
  const parsed = MaterialTextureSchema.safeParse(texture);
  if (!parsed.success) return { success: false, error: "Textura inválida." };

  try {
    await db.collection("defaultMaterials").doc(id).update({ texture: parsed.data });
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating texture:", error);
    return { success: false, error: error.message || "Error al guardar la textura." };
  }
}

export async function deleteDefaultMaterialTexture(id: string) {
  try {
    await db.collection("defaultMaterials").doc(id).update({ texture: null });
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error removing texture ref:", error);
    return { success: false, error: error.message || "Error al eliminar la referencia de textura." };
  }
}

export async function deleteDefaultMaterial(id: string) {
  try {
    await db.collection("defaultMaterials").doc(id).delete();
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting default material:", error);
    return { success: false, error: error.message || "Error al eliminar el material estándar." };
  }
}
