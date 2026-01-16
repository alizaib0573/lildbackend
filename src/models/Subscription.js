const { db } = require('../config/firebase');

class Subscription {
  static async create(subscriptionData) {
    const subscriptionToCreate = {
      ...subscriptionData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    delete subscriptionToCreate.id;
    
    const subscriptionRef = await db.collection('subscriptions').add(subscriptionToCreate);
    return { id: subscriptionRef.id, ...subscriptionToCreate };
  }

  static async findById(id) {
    const subscriptionDoc = await db.collection('subscriptions').doc(id).get();
    if (!subscriptionDoc.exists) return null;
    
    const subscription = { id: subscriptionDoc.id, ...subscriptionDoc.data() };
    
    // Populate pricingPlan if exists
    if (subscription.pricingPlan) {
      subscription.pricingPlan = await PricingPlan.findById(subscription.pricingPlan);
    }
    
    return subscription;
  }

  static async findByUserId(userId) {
    const snapshot = await db.collection('subscriptions')
      .where('user', '==', userId)
      .get();
    
    if (snapshot.empty) return null;
    
    const subscriptionDoc = snapshot.docs[0];
    const subscription = { id: subscriptionDoc.id, ...subscriptionDoc.data() };
    
    // Populate pricingPlan
    if (subscription.pricingPlan) {
      subscription.pricingPlan = await PricingPlan.findById(subscription.pricingPlan);
    }
    
    return subscription;
  }

  static async findByStripeSubscriptionId(stripeSubscriptionId) {
    const snapshot = await db.collection('subscriptions')
      .where('stripeSubscriptionId', '==', stripeSubscriptionId)
      .get();
    
    if (snapshot.empty) return null;
    
    const subscriptionDoc = snapshot.docs[0];
    return { id: subscriptionDoc.id, ...subscriptionDoc.data() };
  }

  static async findAll(filter = {}) {
    let query = db.collection('subscriptions');
    
    if (filter.user) {
      query = query.where('user', '==', filter.user);
    }
    
    if (filter.status) {
      if (Array.isArray(filter.status)) {
        query = query.where('status', 'in', filter.status);
      } else {
        query = query.where('status', '==', filter.status);
      }
    }
    
    if (filter.pricingPlan) {
      query = query.where('pricingPlan', '==', filter.pricingPlan);
    }
    
    query = query.orderBy('createdAt', 'desc');
    
    if (filter.populatePlan) {
      const snapshot = await query.get();
      const subscriptions = [];
      
      for (const doc of snapshot.docs) {
        const subscription = { id: doc.id, ...doc.data() };
        
        if (subscription.pricingPlan) {
          subscription.pricingPlan = await PricingPlan.findById(subscription.pricingPlan);
        }
        
        subscriptions.push(subscription);
      }
      
      return subscriptions;
    } else {
      const snapshot = await query.get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
  }

  static async updateById(id, updateData) {
    const updateWithTimestamp = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await db.collection('subscriptions').doc(id).update(updateWithTimestamp);
    
    const updatedSubscription = await this.findById(id);
    return updatedSubscription;
  }

  static async updateByStripeSubscriptionId(stripeSubscriptionId, updateData) {
    const subscription = await this.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!subscription) return null;
    
    return await this.updateById(subscription.id, updateData);
  }

  static async deleteById(id) {
    await db.collection('subscriptions').doc(id).delete();
  }

  static async deleteByStripeSubscriptionId(stripeSubscriptionId) {
    const subscription = await this.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!subscription) return null;
    
    await this.deleteById(subscription.id);
    return subscription;
  }

  static async deleteByUserId(userId) {
    const snapshot = await db.collection('subscriptions')
      .where('user', '==', userId)
      .get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
  }

  static async isSubscriptionActive(subscription) {
    const now = new Date();
    const currentPeriodEnd = new Date(subscription.currentPeriodEnd);
    
    return (subscription.status === 'active' || subscription.status === 'trialing') && 
           currentPeriodEnd > now && 
           !subscription.cancelAtPeriodEnd;
  }
}

module.exports = Subscription;