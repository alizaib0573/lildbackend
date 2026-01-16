const express = require('express');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { User, Video, Series, Subscription } = require('../models');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE }
  );
  
  return { accessToken, refreshToken };
};

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await User.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin access required.' });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);

    res.json({
      message: 'Admin login successful',
      user: User.toJSON(user),
      accessToken,
      refreshToken
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/create', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required')
], validateRequest, async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      role: 'admin'
    });

    res.status(201).json({
      message: 'Admin user created successfully',
      user: User.toJSON(user)
    });
  } catch (error) {
    console.error('Admin creation error:', error);
    res.status(500).json({ error: 'Failed to create admin user' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalUsers = (await User.findAll({ role: 'user' })).length;
    const totalVideos = (await Video.findAll({})).length;
    const totalSeries = (await Series.findAll({})).length;
    const activeSubscriptions = (await Subscription.findAll({ status: ['active', 'trialing'] })).length;
    const adminCount = (await User.findAll({ role: 'admin' })).length;

    res.json({
      stats: {
        totalUsers,
        totalVideos,
        totalSeries,
        activeSubscriptions,
        adminCount
      }
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const users = await User.findAll({ role: 'user' });
    const paginatedUsers = users.slice(offset, offset + limit);

    res.json({
      users: paginatedUsers,
      pagination: {
        page,
        limit,
        total: users.length,
        pages: Math.ceil(users.length / limit)
      }
    });
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;