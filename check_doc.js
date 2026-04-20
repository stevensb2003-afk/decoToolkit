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

async function findDocumentType() {
    const id = "wvCDaWViG1M1t8FUuUqo";

    // check projects
    const proj = await db.collection("projects").doc(id).get();
    if (proj.exists) return console.log("It is a Project:", proj.data());

    // check users
    const usr = await db.collection("users").doc(id).get();
    if (usr.exists) return console.log("It is a User:", usr.data());

    // check all placedPieces, surfaces, materials 
    const checks = [
        { name: "placedPieces", collectionName: "placedPieces" },
        { name: "surfaces", collectionName: "surfaces" },
        { name: "materials", collectionName: "materials" },
        { name: "obstacles", collectionName: "obstacles" },
        { name: "remnants", collectionName: "remnants" },
    ];

    for (const check of checks) {
        let allDocs = await db.collectionGroup(check.collectionName).get();
        let found = false;
        allDocs.forEach(doc => {
            if (doc.id === id) {
                console.log(`\nFound it! It's a ${check.name} doc.`);
                console.log("Path:", doc.ref.path);
                console.log("Data:", doc.data());
                found = true;
            }
        });
        if (found) return;
    }

    console.log("Object not found in common collections.");
}

findDocumentType().catch(console.error);
