import admin from 'firebase-admin';

// Initialize Firebase Admin for Local Emulator
if (!admin.apps.length) {
  // Point to the local emulator
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  
  admin.initializeApp({
    projectId: 'demo-bug-app', // 'demo-' prefix bypasses auth and hits emulator
  });
}

const firestore = admin.firestore();

// We export a connect function to keep the `await connectToDatabase()` API route signature intact.
export default async function connectToDatabase() {
  return firestore;
}

export { firestore };
