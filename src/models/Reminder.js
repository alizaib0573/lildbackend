const { db } = require('../config/firebase');

class Reminder {
  static async create(reminderData) {
    const reminderToCreate = {
      ...reminderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isNotified: false
    };
    
    delete reminderToCreate.id;
    
    const reminderRef = await db.collection('reminders').add(reminderToCreate);
    return { id: reminderRef.id, ...reminderToCreate };
  }

  static async findById(id) {
    const reminderDoc = await db.collection('reminders').doc(id).get();
    if (!reminderDoc.exists) return null;
    
    const reminder = { id: reminderDoc.id, ...reminderDoc.data() };
    
    // Populate video if exists
    if (reminder.video) {
      reminder.video = await Video.findById(reminder.video);
    }
    
    // Populate user if exists
    if (reminder.user) {
      reminder.user = await User.findById(reminder.user);
    }
    
    return reminder;
  }

  static async findAll(filter = {}, options = {}) {
    let query = db.collection('reminders');
    
    if (filter.user) {
      query = query.where('user', '==', filter.user);
    }
    
    if (filter.video) {
      query = query.where('video', '==', filter.video);
    }
    
    if (filter.isNotified !== undefined) {
      query = query.where('isNotified', '==', filter.isNotified);
    }
    
    if (filter.reminderDate) {
      if (filter.reminderDate.before) {
        query = query.where('reminderDate', '<=', filter.reminderDate.before);
      }
    }
    
    query = query.orderBy('reminderDate', 'asc');
    
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    if (options.offset) {
      query = query.offset(options.offset);
    }
    
    const snapshot = await query.get();
    const reminders = [];
    
    for (const doc of snapshot.docs) {
      const reminder = { id: doc.id, ...doc.data() };
      
      // Populate related data
      if (reminder.video && filter.populateVideo) {
        reminder.video = await Video.findById(reminder.video);
      }
      
      if (reminder.user && filter.populateUser) {
        reminder.user = await User.findById(reminder.user);
      }
      
      reminders.push(reminder);
    }
    
    return reminders;
  }

  static async count(filter = {}) {
    let query = db.collection('reminders');
    
    if (filter.user) {
      query = query.where('user', '==', filter.user);
    }
    
    if (filter.video) {
      query = query.where('video', '==', filter.video);
    }
    
    if (filter.isNotified !== undefined) {
      query = query.where('isNotified', '==', filter.isNotified);
    }
    
    const snapshot = await query.get();
    return snapshot.size;
  }

  static async updateById(id, updateData) {
    const updateWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('reminders').doc(id).update(updateWithTimestamp);
    
    const updatedReminder = await this.findById(id);
    return updatedReminder;
  }

  static async deleteById(id) {
    await db.collection('reminders').doc(id).delete();
  }

  static async findByUserAndVideo(userId, videoId) {
    const snapshot = await db.collection('reminders')
      .where('user', '==', userId)
      .where('video', '==', videoId)
      .get();
    
    if (snapshot.empty) return null;
    
    const reminderDoc = snapshot.docs[0];
    return { id: reminderDoc.id, ...reminderDoc.data() };
  }

  static async getPendingNotifications(options = {}) {
    const now = new Date().toISOString();
    
    let query = db.collection('reminders')
      .where('isNotified', '==', false)
      .where('reminderDate', '<=', now);
    
    if (options.userId) {
      query = query.where('user', '==', options.userId);
    }
    
    const snapshot = await query.get();
    const reminders = [];
    
    for (const doc of snapshot.docs) {
      const reminder = { id: doc.id, ...doc.data() };
      
      // Populate video and user for notifications
      reminder.video = await Video.findById(reminder.video);
      reminder.user = await User.findById(reminder.user);
      
      reminders.push(reminder);
    }
    
    return reminders;
  }

  static async markAsNotified(id) {
    return await this.updateById(id, { isNotified: true });
  }

  static async markMultipleAsNotified(ids) {
    const batch = db.batch();
    
    for (const id of ids) {
      const reminderRef = db.collection('reminders').doc(id);
      batch.update(reminderRef, { isNotified: true });
    }
    
    await batch.commit();
  }
}

module.exports = Reminder;