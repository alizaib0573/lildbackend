const { db, auth } = require('../config/firebase');
const bcrypt = require('bcrypt');

class User {
  static async findByEmail(email) {
    const snapshot = await db.collection('users').where('email', '==', email).get();
    if (snapshot.empty) return null;
    
    const userDoc = snapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  }

  static async findById(id) {
    const userDoc = await db.collection('users').doc(id).get();
    if (!userDoc.exists) return null;
    return { id: userDoc.id, ...userDoc.data() };
  }

  static async create(userData) {
    const hashedPassword = await bcrypt.hash(userData.password, 12);
    const userToCreate = {
      ...userData,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    delete userToCreate.id;
    
    const userRef = await db.collection('users').add(userToCreate);
    return { id: userRef.id, ...userToCreate };
  }

  static async updateById(id, updateData) {
    const updateWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('users').doc(id).update(updateWithTimestamp);
    
    const updatedUser = await this.findById(id);
    return updatedUser;
  }

  static async updateByEmail(email, updateData) {
    const user = await this.findByEmail(email);
    if (!user) return null;
    
    return await this.updateById(user.id, updateData);
  }

  static async deleteById(id) {
    await db.collection('users').doc(id).delete();
  }

  static async findAll(filter = {}) {
    let query = db.collection('users');
    
    if (filter.role) {
      query = query.where('role', '==', filter.role);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  static toJSON(user) {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async createWithFirebaseAuth(userData) {
    const userRecord = await auth.createUser({
      email: userData.email,
      password: userData.password,
      displayName: `${userData.firstName} ${userData.lastName}`
    });

    const userToCreate = {
      ...userData,
      uid: userRecord.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    delete userToCreate.password;
    delete userToCreate.id;
    
    const userRef = await db.collection('users').add(userToCreate);
    return { id: userRef.id, uid: userRecord.uid, ...userToCreate };
  }
}

module.exports = User;