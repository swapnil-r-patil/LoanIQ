const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
require('dotenv').config();

let db = null;

function initFirebase() {
  if (!db) {
    try {
      // Configuration based on the user's provided Firebase App credentials
      const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID
      };

      // Only attempt to initialize if the API key is present
      if (firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        console.log('✅ Firebase initialized successfully (Client SDK)');
      } else {
        console.warn('⚠️  Firebase credentials missing in .env (running without DB)');
      }
    } catch (error) {
      console.warn('⚠️  Firebase init failed (running without DB):', error.message);
      db = null;
    }
  }
  return db;
}

function getDb() {
  return db;
}

module.exports = { initFirebase, getDb };
