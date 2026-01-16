const { db } = require('../config/firebase');

class Series {
  static async create(seriesData) {
    const seriesToCreate = {
      ...seriesData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    delete seriesToCreate.id;
    
    const seriesRef = await db.collection('series').add(seriesToCreate);
    return { id: seriesRef.id, ...seriesToCreate };
  }

  static async findById(id) {
    const seriesDoc = await db.collection('series').doc(id).get();
    if (!seriesDoc.exists) return null;
    
    const series = { id: seriesDoc.id, ...seriesDoc.data() };
    
    // Populate createdBy if exists
    if (series.createdBy) {
      series.createdBy = await User.findById(series.createdBy);
      if (series.createdBy) {
        series.createdBy = User.toJSON(series.createdBy);
      }
    }
    
    return series;
  }

  static async findAll(filter = {}, options = {}) {
    let query = db.collection('series');
    
    if (filter.isActive !== undefined) {
      query = query.where('isActive', '==', filter.isActive);
    }
    
    if (filter.createdBy) {
      query = query.where('createdBy', '==', filter.createdBy);
    }
    
    query = query.orderBy('createdAt', 'desc');
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    const snapshot = await query.get();
    const seriesList = [];
    
    for (const doc of snapshot.docs) {
      const series = { id: doc.id, ...doc.data() };
      
      if (series.createdBy && filter.populateCreator) {
        const creator = await User.findById(series.createdBy);
        if (creator) {
          series.createdBy = User.toJSON(creator);
        }
      }
      
      seriesList.push(series);
    }
    
    return seriesList;
  }

  static async count(filter = {}) {
    let query = db.collection('series');
    
    if (filter.isActive !== undefined) {
      query = query.where('isActive', '==', filter.isActive);
    }
    
    const snapshot = await query.get();
    return snapshot.size;
  }

  static async updateById(id, updateData) {
    const updateWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('series').doc(id).update(updateWithTimestamp);
    
    const updatedSeries = await this.findById(id);
    return updatedSeries;
  }

  static async deleteById(id) {
    // Check if series has videos
    const videos = await Video.findAll({ series: id });
    if (videos.length > 0) {
      throw new Error('Cannot delete series with existing videos');
    }
    
    await db.collection('series').doc(id).delete();
  }

  static async getWithVideos(id) {
    const series = await this.findById(id);
    if (!series) return null;
    
    const videos = await Video.findAll({ 
      series: id,
      populateSeries: false 
    });
    
    return {
      series,
      videos
    };
  }
}

module.exports = Series;