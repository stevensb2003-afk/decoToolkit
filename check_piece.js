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

async function findPiece() {
    console.log("Searching for piece wvCDaWViG1M1t8FUuUqo...");
    const pieceId = "wvCDaWViG1M1t8FUuUqo";

    const piecesGroup = db.collectionGroup('placedPieces');
    const allPieces = await piecesGroup.get();
    let found = false;

    allPieces.forEach(doc => {
        if (doc.id === pieceId || !doc.data().createdAt) {
            console.log("\n--- Found piece! ---");
            console.log("Document Path:", doc.ref.path);
            console.log("Has createdAt?", !!doc.data().createdAt);
            found = true;
        }
    });

    if (!found) {
        console.log("Piece not found.");
    }
}

findPiece().catch(console.error);
