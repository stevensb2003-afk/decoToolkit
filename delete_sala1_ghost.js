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

async function deleteMarmolInSala1() {
    console.log("Locating 'Sala 1' surfaces and deleting Mármol blanca pieces...");

    // Mármol blanca ID based on the user's screenshot where the legend item #3 is "Marmol blanca" and there are 2 fragments.
    // However, it's safer to just find all materials with name "Mármol" or similar.

    const projects = await db.collection('projects').get();
    let deleted = 0;

    for (const p of projects.docs) {
        const materials = p.data().materials || [];
        const marmolIds = materials
            .filter(m => m.name.toLowerCase().includes('marmol') || m.name.toLowerCase().includes('mármol'))
            .map(m => m.id);

        if (marmolIds.length === 0) continue;

        const surfaces = await p.ref.collection('surfaces').get();
        for (const s of surfaces.docs) {
            if (s.data().name.toLowerCase() === 'sala 1') {
                const pieces = await p.ref.collection('placedPieces')
                    .where('surfaceId', '==', s.id)
                    .where('materialId', 'in', marmolIds)
                    .get();

                for (const piece of pieces.docs) {
                    console.log(`Deleting ghost piece ${piece.id} of Mármol from Sala 1 in Project ${p.id}...`);
                    await piece.ref.delete();
                    deleted++;
                }
            }
        }
    }

    console.log(`Finished. Deleted ${deleted} hidden Mármol pieces from Sala 1.`);
}

deleteMarmolInSala1().catch(console.error);
