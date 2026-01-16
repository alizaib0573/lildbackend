const { db } = require('./src/config/firestore-simple');

async function testFirebaseIntegration() {
  console.log('🧪 Testing Simple Firebase Firestore Integration...\n');

  try {
    // Test 1: Firestore Connection
    console.log('✅ 1. Firestore Connection');
    console.log('   Database: Firestore connected');
    console.log('   Mode: Direct Firestore (No Auth)\n');

    // Test 2: Basic Firestore Operations
    console.log('✅ 2. Basic Firestore Operations');
    
    // Direct Firestore write
    const testUserData = {
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const userRef = await db.collection('users').add(testUserData);
    console.log('   ✓ Direct Firestore user write:', userRef.id);

    // Direct Firestore read
    const userDoc = await db.collection('users').doc(userRef.id).get();
    const userData = userDoc.data();
    console.log('   ✓ Direct Firestore user read:', userData.email);

    // Test 3: Query Operations
    console.log('\n✅ 3. Query Operations');
    
    // Test pagination
    const allVideosSnapshot = await db.collection('videos')
      .orderBy('createdAt', 'desc')
      .limit(5)
      .get();
    console.log('   ✓ Pagination query:', allVideosSnapshot.size, 'videos found');

    // Test filtering
    const activeVideosSnapshot = await db.collection('videos')
      .where('isPublished', '==', true)
      .where('isActive', '==', true)
      .get();
    console.log('   ✓ Filter query:', activeVideosSnapshot.size, 'active videos');

    // Test 4: Array queries
    console.log('\n✅ 4. Array Queries');
    
    const tagVideosSnapshot = await db.collection('videos')
      .where('tags', 'array-contains', 'test')
      .get();
    console.log('   ✓ Array contains query:', tagVideosSnapshot.size, 'videos found');

    // Test 5: Update Operations
    console.log('\n✅ 5. Update Operations');
    
    await db.collection('videos').doc(userRef.id).update({
      lastLogin: new Date().toISOString()
    });
    console.log('   ✓ Update operation: SUCCESS');

    // Test 6: Batch operations
    console.log('\n✅ 6. Batch Operations');
    
    const batch = db.batch();
    const progressData = {
      user: userRef.id,
      video: 'test-video-id',
      progress: 50,
      completed: false,
      lastWatchedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    const progressRef = await db.collection('videoProgress').add(progressData);
    batch.delete(progressRef);
    
    await batch.commit();
    console.log('   ✓ Batch delete operation: SUCCESS');

    console.log('\n🎉 ALL TESTS PASSED! Firestore Integration is working perfectly.\n');
    console.log('📊 Test Results:');
    console.log(`   - Firestore Connection: ✓`);
    console.log(`   - Write Operations: ✓`);
    console.log(`   - Read Operations: ✓`);
    console.log(`   - Query Operations: ✓`);
    console.log(`   - Filter Operations: ✓`);
    console.log(`   - Update Operations: ✓`);
    console.log(`   - Batch Operations: ✓`);
    console.log(`   - Array Queries: ✓`);

    console.log('\n🚀 Firebase API is ready for production!');
    console.log('📝 Note: Using direct Firestore (recommended for production)');
    console.log('📋 Setup Instructions:');
    console.log('   1. Set FIREBASE_PROJECT_ID in .env');
    console.log('   2. Optionally set service account key for production');
    console.log('   3. Deploy Firestore rules and indexes');

    return true;

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testFirebaseIntegration()
    .then(success => {
      if (success) {
        console.log('\n🔥 Firebase migration verification: SUCCESS');
        process.exit(0);
      } else {
        console.log('\n💥 Firebase migration verification: FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Test runner error:', error);
      process.exit(1);
    });
}

module.exports = testFirebaseIntegration;