const { db } = require('../config/firebase');
const { User } = require('./User');
const { Series } = require('./Series');

class Video {
  static async create(videoData) {
    const videoToCreate = {
      ...videoData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      views: 0
    };
    
    delete videoToCreate.id;
    
    const videoRef = await db.collection('videos').add(videoToCreate);
    return { id: videoRef.id, ...videoToCreate };
  }

  static async findById(id) {
    const videoDoc = await db.collection('videos').doc(id).get();
    if (!videoDoc.exists) return null;
    
    const video = { id: videoDoc.id, ...videoDoc.data() };
    
    // Populate series if exists
    if (video.series) {
      video.series = await Series.findById(video.series);
    }
    
    // Populate uploadedBy if exists
    if (video.uploadedBy) {
      const uploader = await User.findById(video.uploadedBy);
      if (uploader) {
        video.uploadedBy = User.toJSON(uploader);
      }
    }
    
    return video;
  }

  static async findAll(filter = {}, options = {}) {
    let query = db.collection('videos');
    
    if (filter.series) {
      query = query.where('series', '==', filter.series);
    }
    
    if (filter.isPublished !== undefined) {
      query = query.where('isPublished', '==', filter.isPublished === 'true');
    }
    
    if (filter.uploadedBy) {
      query = query.where('uploadedBy', '==', filter.uploadedBy);
    }
    
    if (filter.tags && filter.tags.length > 0) {
      query = query.where('tags', 'array-contains-any', filter.tags);
    }
    
    // Date filters for published videos
    if (filter.isAvailable !== undefined) {
      const now = new Date().toISOString();
      query = query
        .where('isPublished', '==', true)
        .where('publishAt', '<=', now)
        .where('isActive', '==', true);
    }
    
    query = query.orderBy('createdAt', 'desc');
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    const snapshot = await query.get();
    const videos = [];
    
    for (const doc of snapshot.docs) {
      const video = { id: doc.id, ...doc.data() };
      
      // Populate related data
      if (video.series && filter.populateSeries) {
        video.series = await Series.findById(video.series);
      }
      
      if (video.uploadedBy && filter.populateUploader) {
        const uploader = await User.findById(video.uploadedBy);
        if (uploader) {
          video.uploadedBy = User.toJSON(uploader);
        }
      }
      
      videos.push(video);
    }
    
    return videos;
  }

  static async count(filter = {}) {
    let query = db.collection('videos');
    
    if (filter.series) {
      query = query.where('series', '==', filter.series);
    }
    
    if (filter.isPublished !== undefined) {
      query = query.where('isPublished', '==', filter.isPublished === 'true');
    }
    
    if (filter.uploadedBy) {
      query = query.where('uploadedBy', '==', filter.uploadedBy);
    }
    
    const snapshot = await query.get();
    return snapshot.size;
  }

  static async updateById(id, updateData) {
    const updateWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('videos').doc(id).update(updateWithTimestamp);
    
    const updatedVideo = await this.findById(id);
    return updatedVideo;
  }

  static async deleteById(id) {
    await db.collection('videos').doc(id).delete();
  }

  static async incrementViews(id) {
    const videoRef = db.collection('videos').doc(id);
    await videoRef.update({
      views: admin.firestore.FieldValue.increment(1)
    });
    
    const updatedVideo = await this.findById(id);
    return updatedVideo;
  }

  static async search(searchTerm, options = {}) {
    const query = db.collection('videos');
    
    // Simple text search - in production, consider using Algolia or Elasticsearch
    query = query
      .where('isPublished', '==', true)
      .where('publishAt', '<=', new Date().toISOString())
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc');
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    const snapshot = await query.get();
    const videos = [];
    
    for (const doc of snapshot.docs) {
      const video = { id: doc.id, ...doc.data() };
      
      // Client-side filtering for search term
      if (searchTerm) {
        const searchText = `${video.title} ${video.description}`.toLowerCase();
        if (searchText.includes(searchTerm.toLowerCase())) {
          videos.push(video);
        }
      } else {
        videos.push(video);
      }
    }
    
    return videos;
  }
}

module.exports = Video;