const express = require('express');
const { body, query } = require('express-validator');
const { Series, Video } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();

router.post('/', authenticate, authorize('admin'), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('thumbnail').trim().notEmpty().withMessage('Thumbnail URL is required')
], validateRequest, async (req, res) => {
  try {
    const seriesData = {
      ...req.body,
      createdBy: req.user._id
    };

    const series = new Series(seriesData);
    await series.save();
    
    await series.populate('createdBy', 'firstName lastName email');

    res.status(201).json({
      message: 'Series created successfully',
      series
    });
  } catch (error) {
    console.error('Series creation error:', error);
    res.status(500).json({ error: 'Failed to create series' });
  }
});

router.get('/', authenticate, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('isActive').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

    const series = await Series.find(filter)
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const seriesWithVideoCount = await Promise.all(
      series.map(async (s) => {
        const videoCount = await Video.countDocuments({ series: s._id });
        return {
          ...s.toObject(),
          videoCount
        };
      })
    );

    const total = await Series.countDocuments(filter);

    res.json({
      series: seriesWithVideoCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Series fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const series = await Series.findById(req.params.id)
      .populate('createdBy', 'firstName lastName email');

    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    const videos = await Video.find({ series: series._id })
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ season: 1, episodeNumber: 1 });

    res.json({
      series,
      videos
    });
  } catch (error) {
    console.error('Series fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

router.put('/:id', authenticate, authorize('admin'), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('thumbnail').optional().trim().notEmpty().withMessage('Thumbnail cannot be empty'),
  body('isActive').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    const series = await Series.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('createdBy', 'firstName lastName email');

    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    res.json({
      message: 'Series updated successfully',
      series
    });
  } catch (error) {
    console.error('Series update error:', error);
    res.status(500).json({ error: 'Failed to update series' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const series = await Series.findById(req.params.id);
    
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    const videoCount = await Video.countDocuments({ series: series._id });
    if (videoCount > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete series with existing videos. Please delete all videos first.' 
      });
    }

    await Series.findByIdAndDelete(req.params.id);

    res.json({ message: 'Series deleted successfully' });
  } catch (error) {
    console.error('Series deletion error:', error);
    res.status(500).json({ error: 'Failed to delete series' });
  }
});

module.exports = router;