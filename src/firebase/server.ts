
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// This file is intended for server-side use only.
// It uses the Firebase Admin SDK.

const ADMIN_APP_NAME = 'firebase-admin-app';

function getServiceAccount() {
  const serviceAccountString = process.env.SERVICE_ACCOUNT_CREDENTIALS;
  if (!serviceAccountString) {
    // In a managed environment, the credentials should be auto-discovered.
    return undefined;
  }
  try {
    return JSON.parse(serviceAccountString);
  } catch (e) {
    console.error('Could not parse service account credentials from SERVICE_ACCOUNT_CREDENTIALS. Please ensure it is a valid JSON string.', e);
    return undefined;
  }
}


export function initializeFirebaseAdmin() {
  // Find an existing admin app to prevent re-initialization.
  const adminApp = getApps().find(app => app.name === ADMIN_APP_NAME);

  if (adminApp) {
    return getSdks(adminApp);
  }

  const serviceAccount = getServiceAccount();

  // In a managed Google Cloud environment (like Firebase Hosting, Cloud Run, etc.),
  // calling initializeApp() without arguments will automatically use the
  // environment's service account credentials.
  const newAdminApp = initializeApp(
    serviceAccount ? { credential: cert(serviceAccount) } : undefined,
    ADMIN_APP_NAME
  );
  return getSdks(newAdminApp);
}

function getSdks(firebaseApp: App) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}
