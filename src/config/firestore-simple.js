// Simple test without firebase-admin SDK credential issues
const { createRequire } = require('module');

let db;

try {
  // Try to use Firestore directly from @google-cloud/firestore
  const { Firestore } = require('@google-cloud/firestore');
  
  db = new Firestore({
    projectId: process.env.FIREBASE_PROJECT_ID || 'media-streaming-api-dev',
    // Skip credentials for development
    // keyFilename: 'path/to/service-account.json',
    // For testing, we'll use emulator
    // host: 'localhost:8080',
    // ssl: false
  });
  
  console.log('✅ Firestore initialized successfully');
} catch (error) {
  console.error('❌ Firestore initialization failed:', error.message);
  process.exit(1);
}

module.exports = { db };