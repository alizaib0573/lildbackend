const admin = require('firebase-admin');

// Development configuration - completely disable Google Auth
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'media-streaming-api-dev',
    // Completely skip credential loading for development
    // credential: admin.credential.cert(serviceAccount),
  });
}

// Initialize services without auth dependencies
const db = admin.firestore();
const storage = admin.storage();
// Auth is null - we'll use JWT tokens instead
const auth = null;

module.exports = {
  db,
  auth,
  storage,
  admin
};