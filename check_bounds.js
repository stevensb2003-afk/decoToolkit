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

async function checkOutOfBounds() {
    console.log("Checking for out-of-bounds pieces...");
    const projects = await db.collection('projects').get();

    for (const p of projects.docs) {
        const surfaces = await p.ref.collection('surfaces').get();
        for (const s of surfaces.docs) {
            const surfData = s.data();
            const w = surfData.width || 0;
            const h = surfData.height || 0;
            const pieces = await p.ref.collection('placedPieces').where('surfaceId', '==', s.id).get();

            for (const piece of pieces.docs) {
                const pd = piece.data();
                // Check if completely outside
                if (pd.x < 0 || pd.x > w || pd.y < 0 || pd.y > h) {
                    console.log(`\nOUT OF BOUNDS: Project ${p.id} | Surface: ${s.id} (${surfData.name})`);
                    console.log(`Piece ID: ${piece.id}`);
                    console.log(`Surface bounds: 0,0 to ${w},${h}`);
                    console.log(`Piece center: ${pd.x}, ${pd.y}`);

                    // Let's print out what it is:
                    const mats = p.data().materials || [];
                    const mat = mats.find(m => m.id === pd.materialId);
                    console.log(`Material: ${mat ? mat.name : pd.materialId}`);
                }
            }
        }
    }
}

checkOutOfBounds().catch(console.error);
