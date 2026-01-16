const admin = require('firebase-admin');

// Development configuration without service account
// In production, uncomment and use service account

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'media-streaming-api-dev',
    // For development without service account
    // In production, uncomment this line:
    // credential: admin.credential.cert(require('../../firebase-service-account.json')),
  });
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

module.exports = {
  db,
  auth,
  storage,
  admin
};