const express = require('express');
const { body, query } = require('express-validator');
const { Video, User, Series } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { generatePresignedUploadUrl, deleteS3Object } = require('../services/aws');

const router = express.Router();

router.post('/upload-url', authenticate, authorize('admin'), [
  body('fileName').notEmpty().withMessage('File name is required'),
  body('contentType').optional().isIn(['video/mp4', 'video/quicktime', 'video/x-msvideo'])
], validateRequest, async (req, res) => {
  try {
    const { fileName, contentType = 'video/mp4' } = req.body;
    
    const key = `videos/${Date.now()}-${fileName}`;
    const uploadUrl = await generatePresignedUploadUrl(key, contentType);
    
    res.json({
      uploadUrl,
      key,
      expiresIn: 3600
    });
  } catch (error) {
    console.error('Upload URL generation error:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

router.post('/', authenticate, authorize('admin'), [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('thumbnail').trim().notEmpty().withMessage('Thumbnail URL is required'),
  body('duration').isNumeric().withMessage('Duration must be a number'),
  body('s3Key').trim().notEmpty().withMessage('S3 key is required'),
  body('hlsUrl').trim().notEmpty().withMessage('HLS URL is required'),
  body('series').optional().isMongoId().withMessage('Invalid series ID'),
  body('episodeNumber').optional().isNumeric(),
  body('season').optional().isNumeric(),
  body('publishAt').optional().isISO8601().withMessage('Invalid publish date'),
  body('tags').optional().isArray()
], validateRequest, async (req, res) => {
  try {
    const videoData = {
      ...req.body,
      uploadedBy: req.user.id,
      publishAt: req.body.publishAt ? new Date(req.body.publishAt) : new Date(),
      isPublished: true
    };

    const video = await Video.create(videoData);
    
    res.status(201).json({
      message: 'Video created successfully',
      video
    });
  } catch (error) {
    console.error('Video creation error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
});

router.get('/', authenticate, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('series').optional().isMongoId(),
  query('isPublished').optional().isBoolean()
], validateRequest, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    const filter = {};
    if (req.query.series) filter.series = req.query.series;
    if (req.query.isPublished !== undefined) filter.isPublished = req.query.isPublished === 'true';

    const videos = await Video.findAll(filter, {
      limit,
      offset,
      populateSeries: true,
      populateUploader: true
    });

    const total = await Video.count(filter);

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

router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ video });
  } catch (error) {
    console.error('Video fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

router.put('/:id', authenticate, authorize('admin'), [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('thumbnail').optional().trim().notEmpty().withMessage('Thumbnail cannot be empty'),
  body('duration').optional().isNumeric(),
  body('series').optional().isMongoId(),
  body('episodeNumber').optional().isNumeric(),
  body('season').optional().isNumeric(),
  body('publishAt').optional().isISO8601(),
  body('isPublished').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  body('tags').optional().isArray()
], validateRequest, async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.publishAt) {
      updateData.publishAt = new Date(updateData.publishAt);
    }

    const video = await Video.updateById(req.params.id, updateData);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({
      message: 'Video updated successfully',
      video
    });
  } catch (error) {
    console.error('Video update error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    try {
      await deleteS3Object(video.s3Key);
    } catch (s3Error) {
      console.warn('Failed to delete video from S3:', s3Error);
    }

    await Video.deleteById(req.params.id);

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    console.error('Video deletion error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
});

router.post('/:id/views', authenticate, async (req, res) => {
  try {
    const video = await Video.incrementViews(req.params.id);

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json({ views: video.views });
  } catch (error) {
    console.error('View count update error:', error);
    res.status(500).json({ error: 'Failed to update view count' });
  }
});

module.exports = router;