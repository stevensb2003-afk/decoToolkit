const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const sa = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(sa)
});

const db = admin.firestore();

// IDs of ghost projects to search for
const ghostIds = [
  '0tGNcPDOYRMDQD2owFkC',
  '1nUWOoHkoA55UqyjM0Jm',
  '2UvFdbrBDGotzpDYDKxG',
  '4HGzobqcFCG3hO747cIw',
  '5nsPZ8KO8aeFePTfmY0v'
];

async function scanAllCollections() {
  const collections = [
    'branches', 'cashRegisters', 'cashSessions', 'cashTransactions', 
    'defaultMaterials', 'pricing_rules', 'pricing_settings', 
    'processes', 'settings', 'users'
  ];

  console.log('Cross-referencing ghost project IDs in other collections...');
  
  for (const collName of collections) {
    console.log(`Checking collection: ${collName}...`);
    const snapshot = await db.collection(collName).get();
    
    snapshot.forEach(doc => {
      const data = JSON.stringify(doc.data());
      for (const ghostId of ghostIds) {
        if (data.includes(ghostId)) {
          console.log(`[FOUND] Ghost ID ${ghostId} mentioned in ${collName}/${doc.id}`);
          console.log(`  Data fragment: ${data.substring(data.indexOf(ghostId) - 50, data.indexOf(ghostId) + 100)}`);
        }
      }
    });
  }
  console.log('Done scanning.');
}

scanAllCollections().catch(console.error);
