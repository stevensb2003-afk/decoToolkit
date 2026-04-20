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

async function analyzeSala1() {
    console.log("Looking for project with a surface named 'Sala 1'...");

    // Find the project containing "Sala 1"
    const surfacesGroup = db.collectionGroup('surfaces');
    const sala1Surfaces = await surfacesGroup.where('name', '==', 'Sala 1').get();

    if (sala1Surfaces.empty) {
        console.log("Could not find any surface named 'Sala 1'.");
        return;
    }

    // Process all projects that have a Sala 1
    for (const surfaceDoc of sala1Surfaces.docs) {
        const surfaceData = surfaceDoc.data();
        const projectRef = surfaceDoc.ref.parent.parent;
        const projectDoc = await projectRef.get();
        if (!projectDoc.exists) continue;

        console.log("\n==================================");
        console.log(`Found Project: ${projectDoc.data().projectName} (ID: ${projectDoc.id})`);
        console.log(`Surface 'Sala 1' ID: ${surfaceDoc.id}`);
        console.log("==================================");

        // Let's get materials so we can map names
        const materialsDoc = projectDoc.data().materials || [];
        const materialMap = {};
        for (const m of materialsDoc) {
            materialMap[m.id] = m.name;
        }

        // Get all pieces for this surface
        const piecesRef = projectRef.collection('placedPieces');
        const pieces = await piecesRef.where('surfaceId', '==', surfaceDoc.id).get();

        if (pieces.empty) {
            console.log("No pieces placed on this surface.");
            continue;
        }

        console.log(`Total Pieces on this surface: ${pieces.size}`);

        pieces.forEach(pieceDoc => {
            const data = pieceDoc.data();
            const matName = materialMap[data.materialId] || data.materialId;
            console.log(`- Piece ID: ${pieceDoc.id} | Material: ${matName} | createdAt: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'MISSING'} | Fragments: ${data.fragments ? data.fragments.length : 0}`);
        });

    }
}

analyzeSala1().catch(console.error);
