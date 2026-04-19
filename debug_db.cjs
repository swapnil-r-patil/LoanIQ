const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

// Since this is a test script, we need the Firebase config
// Wait, we can just require the backend's dbService or config/firebase
const { getDb } = require('./backend/config/firebase');

async function testDb() {
  try {
    const db = getDb();
    if (!db) {
      console.log("No DB connection");
      process.exit(1);
    }

    console.log("--- APPLICANT USERS ---");
    const appSnap = await getDocs(query(collection(db, 'applicant_users'), limit(5)));
    appSnap.forEach(doc => {
      console.log(doc.id, "=>", doc.data());
    });

    console.log("\n--- LOAN APPLICATIONS ---");
    const loanSnap = await getDocs(query(collection(db, 'loan_applications'), limit(5)));
    loanSnap.forEach(doc => {
      console.log(doc.id, "=>", doc.data().userId, doc.data().customerDetails?.name);
    });
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

testDb();
