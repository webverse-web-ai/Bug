import admin from 'firebase-admin';

// Initialize Firebase Admin for Live Cloud Firestore
if (!admin.apps.length) {
  try {
    // Attempt to use Service Account credentials if provided
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // Handle newline characters in the private key from .env properly
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Fallback for Application Default Credentials (ADC)
      admin.initializeApp({
        projectId: 'bug-app-b1068',
      });
      console.warn("Firebase Admin initialized without a specific service account key. Ensure Application Default Credentials are valid, or add FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID to your .env file.");
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error.stack);
  }
}

const firestore = admin.firestore();

// Convert a Firestore Timestamp (or Date / serialized value) to millis for
// in-memory sorting. We sort in JS instead of using Firestore .orderBy() so we
// don't require composite indexes in production.
export function toMillis(v) {
  if (!v) return 0;
  if (typeof v.toMillis === 'function') return v.toMillis(); // Firestore Timestamp
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// We export a connect function to keep the `await connectToDatabase()` API route signature intact.
export default async function connectToDatabase() {
  return firestore;
}

export { firestore };
