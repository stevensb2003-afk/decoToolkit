
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function verify() {
  console.log('Starting Firebase Verification...');

  try {
    const serviceAccount = process.env.SERVICE_ACCOUNT_CREDENTIALS;
    if (!serviceAccount) {
      throw new Error('SERVICE_ACCOUNT_CREDENTIALS not found in .env.local');
    }

    const credentials = JSON.parse(serviceAccount);
    console.log(`Found credentials for project: ${credentials.project_id}`);

    const app = initializeApp({
      credential: cert(credentials),
    });

    // Verify Auth
    console.log('Verifying Authentication (Admin SDK)...');
    const auth = getAuth(app);
    const listUsersResult = await auth.listUsers(1);
    console.log(`✅ Auth connected. Retrieved ${listUsersResult.users.length} users.`);

    // Verify Firestore
    console.log('Verifying Firestore (Admin SDK)...');
    const db = getFirestore(app);
    const testDocRef = db.collection('_verification_test').doc('test_doc');
    await testDocRef.set({ timestamp: new Date(), status: 'verified' });
    console.log('✅ Firestore write successful.');
    
    const doc = await testDocRef.get();
    if (doc.exists) {
        console.log('✅ Firestore read successful.');
    } else {
        console.error('❌ Firestore read failed: Document not found.');
    }

    // Clean up
    await testDocRef.delete();
    console.log('✅ Firestore cleanup successful.');

    console.log('🎉 All backend verification steps passed!');

  } catch (error) {
    console.error('❌ Verification FAILED:', error);
    process.exit(1);
  }
}

verify();
