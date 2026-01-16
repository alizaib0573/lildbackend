const { db } = require('../config/firebase');

class VideoProgress {
  static async create(progressData) {
    const progressToCreate = {
      ...progressData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    delete progressToCreate.id;
    
    const progressRef = await db.collection('videoProgress').add(progressToCreate);
    return { id: progressRef.id, ...progressToCreate };
  }

  static async findById(id) {
    const progressDoc = await db.collection('videoProgress').doc(id).get();
    if (!progressDoc.exists) return null;
    return { id: progressDoc.id, ...progressDoc.data() };
  }

  static async findByUserAndVideo(userId, videoId) {
    const snapshot = await db.collection('videoProgress')
      .where('user', '==', userId)
      .where('video', '==', videoId)
      .get();
    
    if (snapshot.empty) return null;
    
    const progressDoc = snapshot.docs[0];
    return { id: progressDoc.id, ...progressDoc.data() };
  }

  static async findAll(filter = {}) {
    let query = db.collection('videoProgress');
    
    if (filter.user) {
      query = query.where('user', '==', filter.user);
    }
    
    if (filter.video) {
      query = query.where('video', '==', filter.video);
    }
    
    if (filter.completed !== undefined) {
      query = query.where('completed', '==', filter.completed);
    }
    
    query = query.orderBy('lastWatchedAt', 'desc');
    
    if (filter.limit) {
      query = query.limit(filter.limit);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async updateById(id, updateData) {
    const updateWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('videoProgress').doc(id).update(updateWithTimestamp);
    
    const updatedProgress = await this.findById(id);
    return updatedProgress;
  }

  static async upsertByUserAndVideo(userId, videoId, updateData) {
    const existingProgress = await this.findByUserAndVideo(userId, videoId);
    
    const progressUpdate = {
      ...updateData,
      lastWatchedAt: new Date().toISOString(),
      completed: updateData.progress >= 90
    };
    
    if (existingProgress) {
      return await this.updateById(existingProgress.id, progressUpdate);
    } else {
      const newProgressData = {
        user: userId,
        video: videoId,
        ...progressUpdate
      };
      return await this.create(newProgressData);
    }
  }

  static async deleteById(id) {
    await db.collection('videoProgress').doc(id).delete();
  }

  static async deleteByUser(userId) {
    const snapshot = await db.collection('videoProgress')
      .where('user', '==', userId)
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }

  static async getUserProgressSummary(userId) {
    const snapshot = await db.collection('videoProgress')
      .where('user', '==', userId)
      .get();
    
    const total = snapshot.size;
    const completed = snapshot.docs.filter(doc => doc.data().completed).length;
    
    return {
      total,
      completed,
      inProgress: total - completed
    };
  }
}

module.exports = VideoProgress;