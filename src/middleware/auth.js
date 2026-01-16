const jwt = require('jsonwebtoken');
const { User, Subscription } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(401).json({ error: 'Invalid token. User not found.' });
      }
      
      req.user = user;
      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. Authentication required.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

const requireSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findByUserId(req.user._id);

    if (!subscription) {
      return res.status(403).json({ 
        error: 'Access denied. Active subscription required.' 
      });
    }

    const isActive = await Subscription.isSubscriptionActive(subscription);

    if (!isActive) {
      return res.status(403).json({ 
        error: 'Access denied. Active subscription required.' 
      });
    }

    req.subscription = subscription;
    next();
  } catch (error) {
    console.error('Subscription check error:', error);
    res.status(500).json({ error: 'Server error during subscription check.' });
  }
};

module.exports = {
  authenticate,
  authorize,
  requireSubscription
};