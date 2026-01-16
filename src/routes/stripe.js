const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, query } = require('express-validator');
const { PricingPlan, Subscription, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

router.get('/plans', [
  query('active').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';

    const plans = await PricingPlan.find(filter).sort({ price: 1 });
    res.json({ plans });
  } catch (error) {
    console.error('Pricing plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing plans' });
  }
});

router.post('/create-checkout-session', authenticate, [
  body('priceId').notEmpty().withMessage('Price ID is required'),
  body('successUrl').isURL().withMessage('Success URL is required'),
  body('cancelUrl').isURL().withMessage('Cancel URL is required')
], validateRequest, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body;

    const pricingPlan = await PricingPlan.findOne({ 
      stripePriceId: priceId,
      isActive: true 
    });

    if (!pricingPlan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    const user = await User.findById(req.user._id);
    
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: {
          userId: user._id.toString()
        }
      });
      
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await user.save();
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user._id.toString(),
        pricingPlanId: pricingPlan._id.toString()
      }
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Checkout session creation error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

router.get('/subscription', authenticate, async (req, res) => {
  try {
    const { Subscription } = require('../models');
    
    const subscription = await Subscription.findOne({ 
      user: req.user._id 
    }).populate('pricingPlan');

    if (!subscription) {
      return res.json({ subscription: null });
    }

    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.stripeSubscriptionId
    );

    const updatedSubscription = await Subscription.findByIdAndUpdate(
      subscription._id,
      {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        trialStart: stripeSubscription.trial_start ? 
          new Date(stripeSubscription.trial_start * 1000) : null,
        trialEnd: stripeSubscription.trial_end ? 
          new Date(stripeSubscription.trial_end * 1000) : null
      },
      { new: true }
    ).populate('pricingPlan');

    res.json({ subscription: updatedSubscription });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

router.post('/cancel-subscription', authenticate, [
  body('immediate').optional().isBoolean(),
  body('reason').optional().isString().trim()
], validateRequest, async (req, res) => {
  try {
    const { immediate = false, reason } = req.body;

    const subscription = await Subscription.findOne({ 
      user: req.user._id 
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (immediate) {
      await stripe.subscriptions.del(subscription.stripeSubscriptionId);
      await Subscription.findByIdAndDelete(subscription._id);
      
      res.json({ 
        message: 'Subscription cancelled immediately',
        cancelledImmediately: true
      });
    } else {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });

      subscription.cancelAtPeriodEnd = true;
      await subscription.save();

      res.json({ 
        message: 'Subscription will be cancelled at period end',
        cancelledImmediately: false,
        cancelAtPeriodEnd: true
      });
    }
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

router.post('/reactivate-subscription', authenticate, async (req, res) => {
  try {
    const subscription = await Subscription.findOne({ 
      user: req.user._id 
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    if (!subscription.cancelAtPeriodEnd) {
      return res.status(400).json({ error: 'Subscription is not scheduled for cancellation' });
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false
    });

    subscription.cancelAtPeriodEnd = false;
    await subscription.save();

    res.json({ 
      message: 'Subscription reactivated successfully',
      subscription
    });
  } catch (error) {
    console.error('Subscription reactivation error:', error);
    res.status(500).json({ error: 'Failed to reactivate subscription' });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleCheckoutCompleted(session) {
  const { userId, pricingPlanId } = session.metadata;
  
  if (!userId || !pricingPlanId) {
    console.error('Missing metadata in checkout session');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription);
  const pricingPlan = await PricingPlan.findById(pricingPlanId);

  if (!pricingPlan) {
    console.error('Pricing plan not found');
    return;
  }

  const newSubscription = new Subscription({
    user: userId,
    pricingPlan: pricingPlanId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: session.customer,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialStart: subscription.trial_start ? 
      new Date(subscription.trial_start * 1000) : null,
    trialEnd: subscription.trial_end ? 
      new Date(subscription.trial_end * 1000) : null
  });

  await newSubscription.save();
  
  await User.findByIdAndUpdate(userId, {
    subscription: newSubscription._id
  });
}

async function handlePaymentSucceeded(invoice) {
  const subscriptionId = invoice.subscription;
  
  const subscription = await Subscription.findOne({ 
    stripeSubscriptionId: subscriptionId 
  });

  if (subscription) {
    subscription.status = 'active';
    await subscription.save();
  }
}

async function handlePaymentFailed(invoice) {
  const subscriptionId = invoice.subscription;
  
  const subscription = await Subscription.findOne({ 
    stripeSubscriptionId: subscriptionId 
  });

  if (subscription) {
    subscription.status = 'past_due';
    await subscription.save();
  }
}

async function handleSubscriptionUpdated(stripeSubscription) {
  const subscription = await Subscription.findOne({ 
    stripeSubscriptionId: stripeSubscription.id 
  });

  if (subscription) {
    subscription.status = stripeSubscription.status;
    subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
    subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
    subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
    subscription.trialStart = stripeSubscription.trial_start ? 
      new Date(stripeSubscription.trial_start * 1000) : null;
    subscription.trialEnd = stripeSubscription.trial_end ? 
      new Date(stripeSubscription.trial_end * 1000) : null;
    
    await subscription.save();
  }
}

async function handleSubscriptionDeleted(stripeSubscription) {
  await Subscription.findOneAndDelete({ 
    stripeSubscriptionId: stripeSubscription.id 
  });
  
  const user = await User.findOne({ stripeCustomerId: stripeSubscription.customer });
  if (user) {
    user.subscription = null;
    await user.save();
  }
}

module.exports = router;