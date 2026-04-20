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

async function listSurfaces() {
    console.log("Listing all surfaces in all projects...");
    const projects = await db.collection('projects').get();

    for (const p of projects.docs) {
        console.log(`\nProject: ${p.data().projectName} (${p.id})`);
        const surfaces = await p.ref.collection('surfaces').get();
        for (const s of surfaces.docs) {
            console.log(`  - Surface: "${s.data().name}" (ID: ${s.id})`);
        }
    }
}

listSurfaces().catch(console.error);
