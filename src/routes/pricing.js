const express = require('express');
const { body, query } = require('express-validator');
const { PricingPlan, Subscription } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

router.post('/', authenticate, authorize('admin'), [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isNumeric().withMessage('Price must be a number'),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP']),
  body('interval').isIn(['month', 'year']).withMessage('Interval must be month or year'),
  body('features').optional().isArray(),
  body('maxVideoQuality').optional().isIn(['720p', '1080p', '4k']),
  body('concurrentStreams').optional().isInt({ min: 1, max: 10 })
], validateRequest, async (req, res) => {
  try {
    const { name, description, price, currency = 'USD', interval, features = [], maxVideoQuality = '1080p', concurrentStreams = 2 } = req.body;

    const stripeProduct = await stripe.products.create({
      name: name,
      description: description,
      metadata: {
        maxVideoQuality,
        concurrentStreams: concurrentStreams.toString()
      }
    });

    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(price * 100),
      currency: currency.toLowerCase(),
      recurring: {
        interval: interval
      }
    });

    const pricingPlan = new PricingPlan({
      name,
      description,
      price,
      currency,
      interval,
      stripePriceId: stripePrice.id,
      features,
      maxVideoQuality,
      concurrentStreams
    });

    await pricingPlan.save();

    res.status(201).json({
      message: 'Pricing plan created successfully',
      plan: pricingPlan
    });
  } catch (error) {
    console.error('Pricing plan creation error:', error);
    res.status(500).json({ error: 'Failed to create pricing plan' });
  }
});

router.get('/', [
  query('active').optional().isBoolean(),
  query('interval').optional().isIn(['month', 'year'])
], validateRequest, async (req, res) => {
  try {
    const filter = {};
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';
    if (req.query.interval) filter.interval = req.query.interval;

    const plans = await PricingPlan.find(filter).sort({ price: 1 });
    res.json({ plans });
  } catch (error) {
    console.error('Pricing plans fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing plans' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const plan = await PricingPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    res.json({ plan });
  } catch (error) {
    console.error('Pricing plan fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pricing plan' });
  }
});

router.put('/:id', authenticate, authorize('admin'), [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('price').optional().isNumeric().withMessage('Price must be a number'),
  body('currency').optional().isIn(['USD', 'EUR', 'GBP']),
  body('interval').optional().isIn(['month', 'year']),
  body('features').optional().isArray(),
  body('isActive').optional().isBoolean(),
  body('maxVideoQuality').optional().isIn(['720p', '1080p', '4k']),
  body('concurrentStreams').optional().isInt({ min: 1, max: 10 })
], validateRequest, async (req, res) => {
  try {
    const plan = await PricingPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    const updateData = { ...req.body };

    if (req.body.name || req.body.description) {
      const updatedName = req.body.name || plan.name;
      const updatedDescription = req.body.description || plan.description;
      
      const stripePrice = await stripe.prices.retrieve(plan.stripePriceId);
      await stripe.products.update(
        stripePrice.product,
        {
          name: updatedName,
          description: updatedDescription
        }
      );
    }

    if (req.body.price || req.body.currency || req.body.interval) {
      const updatedPrice = req.body.price || plan.price;
      const updatedCurrency = req.body.currency || plan.currency;
      const updatedInterval = req.body.interval || plan.interval;

      await stripe.prices.update(plan.stripePriceId, {
        unit_amount: Math.round(updatedPrice * 100),
        currency: updatedCurrency.toLowerCase(),
        recurring: {
          interval: updatedInterval
        }
      });
    }

    const updatedPlan = await PricingPlan.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      message: 'Pricing plan updated successfully',
      plan: updatedPlan
    });
  } catch (error) {
    console.error('Pricing plan update error:', error);
    res.status(500).json({ error: 'Failed to update pricing plan' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const plan = await PricingPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    const activeSubscriptions = await Subscription.countDocuments({ 
      pricingPlan: plan._id,
      status: { $in: ['active', 'trialing'] }
    });

    if (activeSubscriptions > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete pricing plan with active subscriptions. Deactivate it instead.' 
      });
    }

    try {
      await stripe.prices.update(plan.stripePriceId, { active: false });
    } catch (stripeError) {
      console.warn('Failed to archive Stripe price:', stripeError);
    }

    await PricingPlan.findByIdAndDelete(req.params.id);

    res.json({ message: 'Pricing plan deleted successfully' });
  } catch (error) {
    console.error('Pricing plan deletion error:', error);
    res.status(500).json({ error: 'Failed to delete pricing plan' });
  }
});

router.post('/:id/deactivate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const plan = await PricingPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    plan.isActive = false;
    await plan.save();

    try {
      await stripe.prices.update(plan.stripePriceId, { active: false });
    } catch (stripeError) {
      console.warn('Failed to archive Stripe price:', stripeError);
    }

    res.json({
      message: 'Pricing plan deactivated successfully',
      plan
    });
  } catch (error) {
    console.error('Pricing plan deactivation error:', error);
    res.status(500).json({ error: 'Failed to deactivate pricing plan' });
  }
});

router.post('/:id/activate', authenticate, authorize('admin'), async (req, res) => {
  try {
    const plan = await PricingPlan.findById(req.params.id);

    if (!plan) {
      return res.status(404).json({ error: 'Pricing plan not found' });
    }

    plan.isActive = true;
    await plan.save();

    try {
      await stripe.prices.update(plan.stripePriceId, { active: true });
    } catch (stripeError) {
      console.warn('Failed to unarchive Stripe price:', stripeError);
    }

    res.json({
      message: 'Pricing plan activated successfully',
      plan
    });
  } catch (error) {
    console.error('Pricing plan activation error:', error);
    res.status(500).json({ error: 'Failed to activate pricing plan' });
  }
});

module.exports = router;