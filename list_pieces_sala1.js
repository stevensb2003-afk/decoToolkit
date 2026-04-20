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
        credential: admin.credential.applicationDefault()
    });
}
const db = admin.firestore();

async function checkPieces() {
    console.log("Fetching all projects to find Sala 1 pieces...");
    const projects = await db.collection('projects').get();

    for (const p of projects.docs) {
        const mats = p.data().materials || [];
        const matMap = {};
        for (const m of mats) {
            matMap[m.id] = m.name;
        }

        const surfaces = await p.ref.collection('surfaces').get();
        for (const s of surfaces.docs) {
            const surfData = s.data();
            if (surfData.name && surfData.name.toLowerCase() === 'sala 1') {
                console.log(`\nFound Surface "Sala 1" in Project ${p.id}`);
                const pieces = await p.ref.collection('placedPieces').where('surfaceId', '==', s.id).get();
                console.log(`Total Pieces: ${pieces.size}`);
                pieces.forEach(piece => {
                    const pd = piece.data();
                    const matName = matMap[pd.materialId] || pd.materialId;
                    console.log(`  - Piece HD: ${piece.id} | Material: ${matName} | Fragments: ${pd.fragments ? pd.fragments.length : 0} | X: ${pd.x}, Y: ${pd.y}, W: ${pd.width}, H: ${pd.height}`);
                });
            }
        }
    }
}

checkPieces().catch(console.error);
