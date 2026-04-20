const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

admin.initializeApp({
    credential: admin.credential.applicationDefault()
});

console.log("Admin SDK Project ID:", admin.app().options.projectId);
// Let's also read env project id
console.log("ENV Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
