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

async function scan() {
    const projects = await db.collection('projects').get();
    console.log(`Found ${projects.size} projects.`);

    for (const p of projects.docs) {
        console.log(`Checking project: ${p.id} - ${p.data().projectName}`);
        const surfaces = await p.ref.collection('surfaces').get();
        for (const s of surfaces.docs) {
            if (s.data().name === 'Sala 1' || s.data().name === 'sala 1') {
                console.log(`+++ Found Sala 1 in Project ${p.id} !`);
                const pieces = await p.ref.collection('placedPieces').get();
                console.log(`Total placedPieces: ${pieces.size}`);
                pieces.forEach(piece => {
                    const d = piece.data();
                    console.log(`- Piece ID: ${piece.id} | Material: ${d.materialId} | Surface: ${d.surfaceId}`);
                });
            }
        }
    }
}

scan().catch(console.error);
