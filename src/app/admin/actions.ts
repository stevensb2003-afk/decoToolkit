
"use server";

import { revalidatePath } from 'next/cache';
import { initializeFirebaseAdmin } from '@/firebase/server';
import { UserProfile } from '@/lib/types';
import { z } from 'zod';

const OWNER_EMAIL = 'stevensb.2003@gmail.com';

const CreateUserSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters long." }),
  permissions: z.object({
    canManageUsers: z.boolean().default(false),
    canEditStandardMaterials: z.boolean().default(false),
    allowedModules: z.array(z.string()).default([]),
  }),
});

type CreateUserValues = z.infer<typeof CreateUserSchema>;


// --- NEW FUNCTION TO VALIDATE AND CREATE THE OWNER PROFILE ---
export async function ensureOwnerProfile(): Promise<{ success: boolean; message: string; }> {
  const { auth, firestore } = initializeFirebaseAdmin();
  try {
    const ownerUserRecord = await auth.getUserByEmail(OWNER_EMAIL);
    const ownerUid = ownerUserRecord.uid;

    const userDocRef = firestore.collection('users').doc(ownerUid);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      // If it exists, make sure it has the right permissions
      await userDocRef.update({
        isAdmin: true,
        'permissions.canManageUsers': true,
      });
      revalidatePath('/admin');
      return { success: true, message: `El perfil del Owner ya existía y sus permisos han sido actualizados. UID: ${ownerUid}` };
    }

    // If it does not exist, create it
    const ownerProfile: Omit<UserProfile, 'id'> = {
      email: OWNER_EMAIL,
      displayName: ownerUserRecord.displayName || 'App Owner',
      isAdmin: true,
      permissions: {
        canManageUsers: true,
        canEditStandardMaterials: true,
        allowedModules: ['caja', 'inventory', 'projects', 'calculator', 'admin', 'procesos', 'tilopay'],
      },
    };
    await userDocRef.set(ownerProfile);

    revalidatePath('/admin');
    return { success: true, message: `¡Éxito! Perfil de Owner creado en la base de datos. UID: ${ownerUid}` };

  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { success: false, message: `Error Crítico: El usuario '${OWNER_EMAIL}' no existe en Firebase Authentication.` };
    }
    return { success: false, message: error.message || "Ocurrió un error desconocido." };
  }
}
// --- END OF NEW FUNCTION ---


export async function createUser(values: CreateUserValues) {
  const { auth, firestore } = initializeFirebaseAdmin();

  // Basic authorization: check if the calling user is the owner.
  // This needs to be more robust in a real app, maybe checking for specific claims.
  // For now, this is a placeholder. A real implementation would verify the UID of the caller.

  const validation = CreateUserSchema.safeParse(values);
  if (!validation.success) {
    return { success: false, error: validation.error.flatten().fieldErrors };
  }

  const { displayName, email, password, permissions } = validation.data;
  const isAdmin = permissions.canManageUsers;

  try {
    // 1. Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    // 2. Set custom claims if they are an admin
    if (isAdmin) {
      await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    }

    // 3. Create user profile document in Firestore
    const userDocRef = firestore.collection('users').doc(userRecord.uid);
    const newUserProfile: Omit<UserProfile, 'id'> = {
      email,
      displayName,
      isAdmin,
      permissions,
    };
    await userDocRef.set(newUserProfile);

    // 4. Revalidate path to show the new user in the list
    revalidatePath('/admin');

    return { success: true };

  } catch (error: any) {
    console.error("Error creating new user:", error);
    // Provide a more user-friendly error message
    if (error.code === 'auth/email-already-exists') {
      return { success: false, error: 'A user with this email address already exists.' };
    }
    return { success: false, error: error.message || "An unknown error occurred while creating the user." };
  }
}

export async function ensureUserProfile(uid: string): Promise<void> {
  const { firestore, auth } = initializeFirebaseAdmin();
  const userDocRef = firestore.collection('users').doc(uid);
  const userDoc = await userDocRef.get();

  if (userDoc.exists) {
    return; // Profile already exists
  }

  try {
    const userRecord = await auth.getUser(uid);
    const { email, displayName } = userRecord;

    const isOwner = email === OWNER_EMAIL;

    const newUserProfile: Omit<UserProfile, 'id'> = {
      email: email || '',
      displayName: displayName || email?.split('@')[0] || 'New User',
      isAdmin: isOwner,
      permissions: {
        canManageUsers: isOwner,
        canEditStandardMaterials: false,
        allowedModules: isOwner ? ['caja', 'inventory', 'projects', 'calculator', 'admin', 'procesos', 'tilopay'] : [],
      }
    };

    await userDocRef.set(newUserProfile);
  } catch (error) {
    console.error(`Failed to create user profile for UID: ${uid}`, error);
    // We don't throw here to not block the sign-in/sign-up flow
  }
}

export async function updateUserProfile(userId: string, data: { displayName: string; permissions: { canManageUsers: boolean; canEditStandardMaterials: boolean; allowedModules: string[] } }) {
  const { auth, firestore } = initializeFirebaseAdmin();

  try {
    // 1. Update Firebase Auth (Display Name)
    await auth.updateUser(userId, {
      displayName: data.displayName,
    });

    // 2. Update Firestore Profile
    await firestore.collection('users').doc(userId).update({
      displayName: data.displayName,
      permissions: data.permissions,
      isAdmin: data.permissions.canManageUsers, // Sync isAdmin with permissions
    });

    // 3. Update Custom Claims
    // Be careful not to overwrite other claims if they exist, but here we are managing admin status
    const customClaims = {
      admin: data.permissions.canManageUsers,
    };
    await auth.setCustomUserClaims(userId, customClaims);

    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error("Error updating user profile:", error);
    throw new Error(error.message || "Failed to update user profile.");
  }
}

export async function deleteUser(userId: string) {
  const { auth, firestore } = initializeFirebaseAdmin();

  try {
    // 1. Delete from Firebase Auth
    await auth.deleteUser(userId);

    // 2. Delete from Firestore
    await firestore.collection('users').doc(userId).delete();

    // 3. Revalidate
    revalidatePath('/admin');
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting user:", error);
    return { success: false, error: error.message || "Failed to delete user." };
  }
}
