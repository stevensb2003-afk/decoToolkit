
"use server";

import { revalidatePath } from "next/cache";
import type { Project, Material, Surface, Unit } from "@/lib/types";
import { z } from "zod";
import { convertToCm } from "./utils";
import { initializeFirebaseAdmin } from "@/firebase/server";

const { firestore: db } = initializeFirebaseAdmin();

const DimensionInputSchema = z.object({
  value: z.coerce.number().positive("El valor debe ser positivo"),
  unit: z.enum(["m", "cm"]),
});

const DefaultMaterialFormSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  width: DimensionInputSchema,
  height: DimensionInputSchema,
});


export async function createDefaultMaterial(formData: unknown) {
  const result = DefaultMaterialFormSchema.safeParse(formData);

  if (!result.success) {
    return {
      success: false,
      error: "Error de validación en el formulario."
    };
  }
  const { name, width, height } = result.data;

  try {
    await db.collection("defaultMaterials").add({
      name,
      width: convertToCm(width.value, width.unit),
      height: convertToCm(height.value, height.unit),
      createdAt: new Date(), // Use Admin SDK's way of setting timestamp
    });
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating default material:", error);
    return {
      success: false,
      error: error.message || "Error al crear el material estándar. Es posible que no tengas permisos.",
    };
  }
}


export async function updateDefaultMaterial(id: string, formData: unknown) {
  const result = DefaultMaterialFormSchema.safeParse(formData);

  if (!result.success) {
    return {
      success: false,
      error: "Error de validación en el formulario.",
    };
  }
  const { name, width, height } = result.data;

  try {
    const docRef = db.collection("defaultMaterials").doc(id);
    await docRef.update({
      name,
      width: convertToCm(width.value, width.unit),
      height: convertToCm(height.value, height.unit),
    });
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating default material:", error);
    return {
      success: false,
      error: error.message || "Error al actualizar el material estándar. Es posible que no tengas permisos.",
    };
  }
}

export async function deleteDefaultMaterial(id: string) {
  try {
    const docRef = db.collection("defaultMaterials").doc(id);
    await docRef.delete();
    revalidatePath("/materials");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting default material:", error);
    return {
      success: false,
      error: error.message || "Error al eliminar el material estándar. Es posible que no tengas permisos.",
    };
  }
}

