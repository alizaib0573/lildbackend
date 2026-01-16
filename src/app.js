const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Firebase initialization
const { db } = require('./config/firestore-simple');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const videoRoutes = require('./routes/video');
const seriesRoutes = require('./routes/series');
const pricingRoutes = require('./routes/pricing');
const reminderRoutes = require('./routes/reminder');
const stripeRoutes = require('./routes/stripe');
const { errorHandler } = require('./middleware/validation');

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Firebase is ready to use
console.log('Firebase initialized successfully');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/series', seriesRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/reminder', reminderRoutes);
app.use('/api/stripe', stripeRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Media Streaming API is running with Firebase',
    database: 'Firebase Firestore',
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API Documentation: See API_DOCUMENTATION.md`);
  console.log(`Database: Firebase Firestore`);
});

module.exports = app;