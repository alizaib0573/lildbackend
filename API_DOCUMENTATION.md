# Media Streaming API Documentation

## Overview
Production-ready backend API for media screening/video streaming web application with JWT authentication, AWS S3/CloudFront integration, and Stripe payment processing.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require JWT token in Authorization header:
```
Authorization: Bearer <access_token>
```

## Authentication Routes (/api/auth)

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "refreshToken": "<refresh_token>"
}
```

### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <access_token>
```

## Admin Routes (/api/admin)

### Admin Login
```http
POST /api/admin/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "adminpass123"
}
```

### Create Admin User
```http
POST /api/admin/create
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "newadmin@example.com",
  "password": "adminpass123",
  "firstName": "Admin",
  "lastName": "User"
}
```

### Get Admin Stats
```http
GET /api/admin/stats
Authorization: Bearer <admin_access_token>
```

### Get All Users
```http
GET /api/admin/users?page=1&limit=10
Authorization: Bearer <admin_access_token>
```

## Video Management Routes (/api/video)

### Generate Upload URL (Admin)
```http
POST /api/video/upload-url
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "fileName": "video.mp4",
  "contentType": "video/mp4"
}
```

### Create Video (Admin)
```http
POST /api/video
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "Sample Video",
  "description": "Video description",
  "thumbnail": "https://example.com/thumb.jpg",
  "duration": 3600,
  "s3Key": "videos/1234567890-video.mp4",
  "hlsUrl": "hls/video.m3u8",
  "series": "series_id",
  "episodeNumber": 1,
  "season": 1,
  "publishAt": "2024-01-15T10:00:00Z",
  "tags": ["action", "drama"]
}
```

### Get All Videos (Admin)
```http
GET /api/video?page=1&limit=20&series=series_id&isPublished=true
Authorization: Bearer <admin_access_token>
```

### Get Video by ID (Admin)
```http
GET /api/video/:id
Authorization: Bearer <admin_access_token>
```

### Update Video (Admin)
```http
PUT /api/video/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "Updated Video Title",
  "description": "Updated description",
  "isPublished": true
}
```

### Delete Video (Admin)
```http
DELETE /api/video/:id
Authorization: Bearer <admin_access_token>
```

### Increment View Count
```http
POST /api/video/:id/views
Content-Type: application/json
```

## Series Management Routes (/api/series)

### Create Series (Admin)
```http
POST /api/series
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "Amazing Series",
  "description": "Series description",
  "thumbnail": "https://example.com/series-thumb.jpg"
}
```

### Get All Series (Admin)
```http
GET /api/series?page=1&limit=20&isActive=true
Authorization: Bearer <admin_access_token>
```

### Get Series by ID (Admin)
```http
GET /api/series/:id
Authorization: Bearer <admin_access_token>
```

### Update Series (Admin)
```http
PUT /api/series/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "Updated Series Title",
  "isActive": true
}
```

### Delete Series (Admin)
```http
DELETE /api/series/:id
Authorization: Bearer <admin_access_token>
```

## User Video Routes (/api/user)

### Get Available Videos
```http
GET /api/user/videos?page=1&limit=20&series=series_id&search=keyword
Authorization: Bearer <access_token>
```

### Get All Series
```http
GET /api/user/series?page=1&limit=20&search=keyword
Authorization: Bearer <access_token>
```

### Get Series by ID
```http
GET /api/user/series/:id
Authorization: Bearer <access_token>
```

### Get Video by ID
```http
GET /api/user/videos/:id
Authorization: Bearer <access_token>
```

### Get Video Stream URL (Requires Subscription)
```http
GET /api/user/videos/:id/stream
Authorization: Bearer <access_token>
```

### Save Video Progress
```http
POST /api/user/videos/:id/progress
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "progress": 75.5
}
```

## Pricing Plans Routes (/api/pricing)

### Create Pricing Plan (Admin)
```http
POST /api/pricing
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Premium Plan",
  "description": "Full HD streaming with 4 concurrent streams",
  "price": 19.99,
  "currency": "USD",
  "interval": "month",
  "features": ["HD Streaming", "4 Concurrent Streams", "No Ads"],
  "maxVideoQuality": "1080p",
  "concurrentStreams": 4
}
```

### Get All Pricing Plans
```http
GET /api/pricing?active=true&interval=month
```

### Get Pricing Plan by ID
```http
GET /api/pricing/:id
```

### Update Pricing Plan (Admin)
```http
PUT /api/pricing/:id
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Updated Plan Name",
  "price": 24.99
}
```

### Delete Pricing Plan (Admin)
```http
DELETE /api/pricing/:id
Authorization: Bearer <admin_access_token>
```

### Deactivate Pricing Plan (Admin)
```http
POST /api/pricing/:id/deactivate
Authorization: Bearer <admin_access_token>
```

### Activate Pricing Plan (Admin)
```http
POST /api/pricing/:id/activate
Authorization: Bearer <admin_access_token>
```

## Stripe Payment Routes (/api/stripe)

### Get Pricing Plans
```http
GET /api/stripe/plans?active=true
```

### Create Checkout Session
```http
POST /api/stripe/create-checkout-session
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "priceId": "price_1234567890",
  "successUrl": "https://yourapp.com/success",
  "cancelUrl": "https://yourapp.com/cancel"
}
```

### Get User Subscription
```http
GET /api/stripe/subscription
Authorization: Bearer <access_token>
```

### Cancel Subscription
```http
POST /api/stripe/cancel-subscription
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "immediate": false,
  "reason": "No longer needed"
}
```

### Reactivate Subscription
```http
POST /api/stripe/reactivate-subscription
Authorization: Bearer <access_token>
```

### Stripe Webhook
```http
POST /api/stripe/webhook
Content-Type: application/json
Stripe-Signature: <signature>
```

## Reminder Routes (/api/reminder)

### Create Reminder
```http
POST /api/reminder
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "videoId": "video_id",
  "reminderDate": "2024-01-20T10:00:00Z",
  "notificationType": "email"
}
```

### Get User Reminders
```http
GET /api/reminder?page=1&limit=20&isNotified=false
Authorization: Bearer <access_token>
```

### Update Reminder
```http
PUT /api/reminder/:id
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "reminderDate": "2024-01-21T10:00:00Z"
}
```

### Delete Reminder
```http
DELETE /api/reminder/:id
Authorization: Bearer <access_token>
```

### Get Pending Reminders
```http
GET /api/reminder/pending
Authorization: Bearer <access_token>
```

### Check and Send Notifications
```http
POST /api/reminder/check-notifications
```

## Error Response Format
```json
{
  "error": "Error message",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format",
      "value": "invalid-email"
    }
  ]
}
```

## Success Response Format
```json
{
  "message": "Operation successful",
  "data": { ... }
}
```

## Rate Limiting
- 100 requests per 15 minutes per IP
- Authentication endpoints have stricter limits

## Security Headers
- All responses include security headers via Helmet
- CORS enabled for cross-origin requests
- Request body limited to 10MB

## Environment Variables Required
See `.env.example` for required environment variables:
- MongoDB connection string
- JWT secrets
- AWS credentials
- Stripe keys
- CloudFront configuration

## Video Upload Process
1. Call `/api/video/upload-url` to get presigned S3 URL
2. Upload video file directly to S3 using the presigned URL
3. Create HLS version and upload to S3
4. Call `/api/video` to create video record with HLS URL

## Subscription Flow
1. User views pricing plans via `/api/pricing`
2. User selects plan and calls `/api/stripe/create-checkout-session`
3. User completes payment via Stripe Checkout
4. Stripe webhook creates subscription record
5. User can access premium content with active subscription