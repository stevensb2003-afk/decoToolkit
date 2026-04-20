const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault() // Or whatever auth is set up locally
    });
}

const db = admin.firestore();

async function deleteGhostPieces() {
    console.log("Searching for ghost pieces (without createdAt)...");

    const piecesGroup = db.collectionGroup('placedPieces');
    const allPieces = await piecesGroup.get();
    let deletedCount = 0;

    const batch = db.batch();

    allPieces.forEach(doc => {
        const data = doc.data();
        if (!data.createdAt) {
            console.log("Found ghost piece:", doc.ref.path);
            batch.delete(doc.ref);
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        console.log(`Committing deletion of ${deletedCount} ghost pieces...`);
        await batch.commit();
        console.log("Successfully deleted ghost pieces.");
    } else {
        console.log("No ghost pieces found.");
    }
}

deleteGhostPieces().catch(console.error);
