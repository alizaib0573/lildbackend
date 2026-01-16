# Media Streaming API

A production-ready backend API for media screening/video streaming web applications built with Node.js, Express, MongoDB, AWS S3/CloudFront, and Stripe.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (Admin/User)
- Secure password hashing with bcrypt
- Token refresh mechanism

### 📹 Video Management
- AWS S3 integration for video storage
- Presigned upload URLs (no direct file handling)
- CloudFront CDN for secure streaming
- HLS video format support
- Video metadata management
- Series/episode organization
- Scheduled publishing with release dates

### 💳 Subscription & Payments
- Stripe integration for payment processing
- Multiple pricing plans support
- Subscription lifecycle management
- Webhook handling for payment events
- Cancel/reactivate subscriptions

### 👥 User Management
- User registration and authentication
- Profile management
- Subscription status tracking
- Admin user management

### 📅 Reminder System
- Video release reminders
- Email notifications
- Pending reminder management

### 🔒 Security
- Rate limiting
- Input validation
- Security headers (Helmet)
- CORS configuration
- Environment variable protection

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: AWS S3
- **CDN**: Amazon CloudFront
- **Payments**: Stripe
- **Security**: Helmet, bcryptjs, express-rate-limit
- **Validation**: express-validator

## Project Structure

```
src/
├── app.js                 # Main application file
├── config/               # Configuration files
├── controllers/          # Route controllers
├── middleware/           # Custom middleware
│   ├── auth.js          # Authentication middleware
│   └── validation.js    # Request validation
├── models/              # MongoDB models
│   ├── User.js
│   ├── Video.js
│   ├── Series.js
│   ├── PricingPlan.js
│   ├── Subscription.js
│   ├── Reminder.js
│   └── index.js
├── routes/              # API routes
│   ├── auth.js
│   ├── admin.js
│   ├── user.js
│   ├── video.js
│   ├── series.js
│   ├── pricing.js
│   ├── reminder.js
│   └── stripe.js
├── services/            # External service integrations
│   └── aws.js
└── utils/               # Utility functions
```

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd media-streaming-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   ```bash
   # Make sure MongoDB is running on your system
   # Default connection: mongodb://localhost:27017/media-streaming
   ```

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

Required environment variables (see `.env.example`):

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/media-streaming

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-key
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# AWS Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-video-bucket-name

# CloudFront Configuration
CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
CLOUDFRONT_PRIVATE_KEY_PATH=path/to/cloudfront/private-key.pem
CLOUDFRONT_KEY_PAIR_ID=your-cloudfront-key-pair-id

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
STRIPE_WEBHOOK_SECRET=whsec_your-stripe-webhook-secret

# Email Configuration (Optional)
EMAIL_FROM=noreply@yourapp.com
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

## API Documentation

See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for detailed API endpoints and examples.

## Video Upload Process

1. **Generate Presigned URL**
   ```bash
   POST /api/video/upload-url
   Authorization: Bearer <admin_token>
   {
     "fileName": "video.mp4",
     "contentType": "video/mp4"
   }
   ```

2. **Upload to S3**
   Use the presigned URL to upload the video directly to S3

3. **Create Video Record**
   ```bash
   POST /api/video
   Authorization: Bearer <admin_token>
   {
     "title": "Sample Video",
     "description": "Video description",
     "s3Key": "videos/1234567890-video.mp4",
     "hlsUrl": "hls/video.m3u8",
     // ... other fields
   }
   ```

## Stripe Integration Setup

1. **Create Stripe Products and Prices**
   - Use the admin endpoints to create pricing plans
   - Or create them manually in Stripe Dashboard

2. **Configure Webhooks**
   - Set up webhook endpoint: `POST /api/stripe/webhook`
   - Configure webhook events:
     - `checkout.session.completed`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

3. **Set CloudFront for Video Streaming**
   - Configure CloudFront distribution for your S3 bucket
   - Set up signed URLs/Cookies for secure streaming
   - Update `.env` with CloudFront configuration

## Creating an Admin User

1. **Register a regular user** via `/api/auth/register`
2. **Manually update role** in MongoDB:
   ```javascript
   db.users.updateOne(
     { email: "admin@example.com" },
     { $set: { role: "admin" } }
   )
   ```
3. **Or use admin creation endpoint** after logging in as an existing admin

## Security Considerations

- JWT secrets should be strong and unique
- AWS credentials should have minimum required permissions
- Stripe webhook secrets must be configured
- CloudFront private keys should be kept secure
- Use HTTPS in production
- Regularly update dependencies
- Implement proper CORS policies for your frontend

## Deployment Notes

### Environment Setup
- Set `NODE_ENV=production`
- Use a process manager like PM2
- Configure reverse proxy (Nginx/Apache)
- Set up SSL/TLS certificates

### Scaling Considerations
- Use MongoDB Atlas for managed database
- Configure CloudFront for global CDN
- Implement logging and monitoring
- Set up database backups
- Consider Redis for session storage

### Health Check
```bash
GET /health
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please create an issue in the repository or contact the development team.