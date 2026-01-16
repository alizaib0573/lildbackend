const express = require('express');
const { query } = require('express-validator');
const { Video, Series } = require('../models');
const { authenticate, requireSubscription } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { generateCloudFrontSignedUrlSimple } = require('../services/aws');

const router = express.Router();

router.get('/videos', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('series').optional().isMongoId(),
  query('search').optional().isString().trim()
], validateRequest, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = {
      isPublished: true,
      publishAt: { $lte: new Date() },
      isActive: true
    };
    
    if (req.query.series) filter.series = req.query.series;
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const videos = await Video.find(filter)
      .populate('series', 'title thumbnail')
      .select('-s3Key -uploadedBy')
      .sort({ publishAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Video.countDocuments(filter);

    res.json({
      videos,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Videos fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

router.get('/series', authenticate, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('search').optional().isString().trim()
], validateRequest, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filter = { isActive: true };
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const series = await Series.find(filter)
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const seriesWithVideoCount = await Promise.all(
      series.map(async (s) => {
        const videoCount = await Video.countDocuments({ 
          series: s._id,
          isPublished: true,
          publishAt: { $lte: new Date() },
          isActive: true
        });
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

router.get('/series/:id', authenticate, async (req, res) => {
  try {
    const series = await Series.findById(req.params.id)
      .populate('createdBy', 'firstName lastName');

    if (!series || !series.isActive) {
      return res.status(404).json({ error: 'Series not found' });
    }

    const videos = await Video.find({ 
      series: series._id,
      isPublished: true,
      publishAt: { $lte: new Date() },
      isActive: true
    })
      .select('-s3Key -uploadedBy')
      .sort({ season: 1, episodeNumber: 1, publishAt: -1 });

    res.json({
      series,
      videos
    });
  } catch (error) {
    console.error('Series fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

router.get('/videos/:id', authenticate, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('series', 'title')
      .select('-s3Key -uploadedBy');

    if (!video || !video.isAvailable) {
      return res.status(404).json({ error: 'Video not found or not available' });
    }

    res.json({ video });
  } catch (error) {
    console.error('Video fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

router.get('/videos/:id/stream', authenticate, requireSubscription, async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video || !video.isAvailable) {
      return res.status(404).json({ error: 'Video not found or not available' });
    }

    if (!video.hlsUrl) {
      return res.status(400).json({ error: 'Video stream not available' });
    }

    const videoPath = video.hlsUrl.replace(/^https?:\/\/[^\/]+\//, '');
    
    const signedUrl = await generateCloudFrontSignedUrl(videoPath, 3600);

    res.json({
      streamUrl: signedUrl,
      expiresInSeconds: 3600
    });
  } catch (error) {
    console.error('Stream URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate stream URL' });
  }
});

router.post('/videos/:id/progress', authenticate, async (req, res) => {
  try {
    const { progress } = req.body;
    
    if (typeof progress !== 'number' || progress < 0 || progress > 100) {
      return res.status(400).json({ error: 'Invalid progress value' });
    }

    const { VideoProgress } = require('../models');
    
    const videoProgress = await VideoProgress.findOneAndUpdate(
      { user: req.user._id, video: req.params.id },
      { 
        progress,
        lastWatchedAt: new Date(),
        completed: progress >= 90
      },
      { upsert: true, new: true }
    );

    res.json({ 
      message: 'Progress saved successfully',
      progress: videoProgress.progress,
      completed: videoProgress.completed
    });
  } catch (error) {
    console.error('Progress save error:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

module.exports = router;