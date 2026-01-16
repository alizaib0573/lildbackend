const { db } = require('../config/firebase');

class PricingPlan {
  static async create(planData) {
    const planToCreate = {
      ...planData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    delete planToCreate.id;
    
    const planRef = await db.collection('pricingPlans').add(planToCreate);
    return { id: planRef.id, ...planToCreate };
  }

  static async findById(id) {
    const planDoc = await db.collection('pricingPlans').doc(id).get();
    if (!planDoc.exists) return null;
    return { id: planDoc.id, ...planDoc.data() };
  }

  static async findAll(filter = {}) {
    let query = db.collection('pricingPlans');
    
    if (filter.isActive !== undefined) {
      query = query.where('isActive', '==', filter.isActive);
    }
    
    if (filter.interval) {
      query = query.where('interval', '==', filter.interval);
    }
    
    query = query.orderBy('price', 'asc');
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  static async findByStripePriceId(stripePriceId) {
    const snapshot = await db.collection('pricingPlans')
      .where('stripePriceId', '==', stripePriceId)
      .get();
    
    if (snapshot.empty) return null;
    
    const planDoc = snapshot.docs[0];
    return { id: planDoc.id, ...planDoc.data() };
  }

  static async updateById(id, updateData) {
    const updateWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('pricingPlans').doc(id).update(updateWithTimestamp);
    
    const updatedPlan = await this.findById(id);
    return updatedPlan;
  }

  static async deleteById(id) {
    // Check if plan has active subscriptions
    const subscriptions = await Subscription.findAll({ 
      pricingPlan: id,
      status: ['active', 'trialing']
    });
    
    if (subscriptions.length > 0) {
      throw new Error('Cannot delete pricing plan with active subscriptions');
    }
    
    await db.collection('pricingPlans').doc(id).delete();
  }

  static async activate(id) {
    return await this.updateById(id, { isActive: true });
  }

  static async deactivate(id) {
    return await this.updateById(id, { isActive: false });
  }
}

module.exports = PricingPlan;