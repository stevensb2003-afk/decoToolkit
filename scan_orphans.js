const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const sa = JSON.parse(process.env.SERVICE_ACCOUNT_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(sa)
});

const db = admin.firestore();

async function scanOrphans() {
  console.log('Scanning projects collection...');
  
  // Note: getCollections() on a document is how we check for subcollections.
  // We first get all "ghost" document IDs. 
  // Firestore's listDocuments() returns documents that exist and also those that are placeholders.
  
  const projectsRef = db.collection('projects');
  const documents = await projectsRef.listDocuments();
  
  console.log(`Found ${documents.length} document references in 'projects'. Verifying data...`);
  
  let orphans = [];
  let existing = 0;
  
  for (const docRef of documents) {
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      // It's a ghost. Let's check if it has subcollections.
      const subcollections = await docRef.listCollections();
      if (subcollections.length > 0) {
        orphans.push({
          id: docRef.id,
          subcollections: subcollections.map(s => s.id)
        });
      }
    } else {
      existing++;
    }
  }
  
  console.log(`\nResults:`);
  console.log(`  Existing Projects: ${existing}`);
  console.log(`  Orphan Projects (Ghost parent, active subcollections): ${orphans.length}`);
  
  if (orphans.length > 0) {
    console.log('\nSample orphans:');
    orphans.slice(0, 5).forEach(o => {
      console.log(`- ID: ${o.id} Subcollections: ${o.subcollections.join(', ')}`);
    });
    
    // Check one orphan for potential metadata in subcollections
    const firstOrphan = orphans[0];
    console.log(`\nInvestigating subcollections of ${firstOrphan.id} for metadata...`);
    for (const subName of firstOrphan.id === 'OtGNcPDOYRMDKD2owFkC' ? ['surfaces', 'placedPieces'] : firstOrphan.subcollections) {
       const subDocs = await projectsRef.doc(firstOrphan.id).collection(subName).limit(3).get();
       subDocs.forEach(sd => {
          console.log(`  [${subName}] Sample Doc Data:`, JSON.stringify(sd.data()).substring(0, 100));
       });
    }
  }
}

scanOrphans().catch(console.error);
