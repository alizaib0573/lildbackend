const express = require('express');
const { body, query } = require('express-validator');
const { Reminder, Video } = require('../models');
const { authenticate } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

router.post('/', authenticate, [
  body('videoId').isMongoId().withMessage('Invalid video ID'),
  body('reminderDate').isISO8601().withMessage('Invalid reminder date'),
  body('notificationType').optional().isIn(['email', 'push', 'both'])
], validateRequest, async (req, res) => {
  try {
    const { videoId, reminderDate, notificationType = 'email' } = req.body;

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    if (video.isAvailable) {
      return res.status(400).json({ error: 'Video is already available' });
    }

    const existingReminder = await Reminder.findOne({
      user: req.user._id,
      video: videoId
    });

    if (existingReminder) {
      return res.status(400).json({ error: 'Reminder already exists for this video' });
    }

    const reminder = new Reminder({
      user: req.user._id,
      video: videoId,
      reminderDate: new Date(reminderDate),
      notificationType
    });

    await reminder.save();
    await reminder.populate('video', 'title thumbnail publishAt');

    res.status(201).json({
      message: 'Reminder created successfully',
      reminder
    });
  } catch (error) {
    console.error('Reminder creation error:', error);
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('isNotified').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = { user: req.user._id };
    if (req.query.isNotified !== undefined) filter.isNotified = req.query.isNotified === 'true';

    const reminders = await Reminder.find(filter)
      .populate('video', 'title thumbnail publishAt')
      .sort({ reminderDate: 1 })
      .skip(skip)
      .limit(limit);

    const total = await Reminder.countDocuments(filter);

    res.json({
      reminders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Reminders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

router.put('/:id', authenticate, [
  body('reminderDate').optional().isISO8601().withMessage('Invalid reminder date'),
  body('notificationType').optional().isIn(['email', 'push', 'both'])
], validateRequest, async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    if (reminder.isNotified) {
      return res.status(400).json({ error: 'Cannot modify a notified reminder' });
    }

    const updateData = { ...req.body };
    if (updateData.reminderDate) {
      updateData.reminderDate = new Date(updateData.reminderDate);
    }

    const updatedReminder = await Reminder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('video', 'title thumbnail publishAt');

    res.json({
      message: 'Reminder updated successfully',
      reminder: updatedReminder
    });
  } catch (error) {
    console.error('Reminder update error:', error);
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

router.get('/pending', authenticate, async (req, res) => {
  try {
    const now = new Date();
    
    const pendingReminders = await Reminder.find({
      user: req.user._id,
      isNotified: false,
      reminderDate: { $lte: now }
    })
      .populate('video', 'title thumbnail publishAt')
      .sort({ reminderDate: 1 });

    res.json({ reminders: pendingReminders });
  } catch (error) {
    console.error('Pending reminders fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch pending reminders' });
  }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const reminder = await Reminder.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!reminder) {
      return res.status(404).json({ error: 'Reminder not found' });
    }

    await Reminder.findByIdAndDelete(req.params.id);

    res.json({ message: 'Reminder deleted successfully' });
  } catch (error) {
    console.error('Reminder deletion error:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

router.post('/check-notifications', async (req, res) => {
  try {
    const now = new Date();
    
    const remindersToNotify = await Reminder.find({
      isNotified: false,
      reminderDate: { $lte: now }
    })
      .populate([
        { path: 'user', select: 'email firstName lastName' },
        { path: 'video', select: 'title thumbnail publishAt' }
      ]);

    const notifiedReminders = [];

    for (const reminder of remindersToNotify) {
      try {
        if (reminder.notificationType === 'email' || reminder.notificationType === 'both') {
          console.log(`Sending email reminder to ${reminder.user.email} for video: ${reminder.video.title}`);
        }

        reminder.isNotified = true;
        await reminder.save();
        
        notifiedReminders.push({
          reminderId: reminder._id,
          userId: reminder.user._id,
          videoId: reminder.video._id,
          userEmail: reminder.user.email,
          videoTitle: reminder.video.title
        });
      } catch (error) {
        console.error('Error sending reminder notification:', error);
      }
    }

    res.json({
      message: 'Notifications processed',
      notifiedCount: notifiedReminders.length,
      notifications: notifiedReminders
    });
  } catch (error) {
    console.error('Notification check error:', error);
    res.status(500).json({ error: 'Failed to process notifications' });
  }
});

module.exports = router;