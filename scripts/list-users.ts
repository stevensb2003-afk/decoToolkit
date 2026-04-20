
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function listAllUsers() {
    try {
        const serviceAccount = process.env.SERVICE_ACCOUNT_CREDENTIALS;
        if (!serviceAccount) throw new Error('SERVICE_ACCOUNT_CREDENTIALS missing');

        const app = initializeApp({
            credential: cert(JSON.parse(serviceAccount)),
        }, 'user-list-app'); // Use unique name to avoid conflicts

        const auth = getAuth(app);
        let nextPageToken;
        const allUsers = [];

        do {
            const listUsersResult = await auth.listUsers(1000, nextPageToken);
            listUsersResult.users.forEach((userRecord) => {
                allUsers.push({
                    uid: userRecord.uid,
                    email: userRecord.email,
                    displayName: userRecord.displayName,
                    lastSignIn: userRecord.metadata.lastSignInTime,
                    creationTime: userRecord.metadata.creationTime
                });
            });
            nextPageToken = listUsersResult.pageToken;
        } while (nextPageToken);

        if (allUsers.length === 0) {
            console.log("No users found.");
        } else {
            console.table(allUsers);
        }

        // Cleanup - though script will exit anyway
        // await app.delete(); 

    } catch (error) {
        console.error('Error listing users:', error);
    }
}

listAllUsers();
