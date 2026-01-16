const { S3Client } = require('@aws-sdk/client-s3');
const { CloudFrontClient, CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// AWS SDK v3 configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const cloudFrontClient = new CloudFrontClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const generatePresignedUploadUrl = async (key, contentType = 'video/mp4') => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ACL: 'private'
  });

  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
};

const generateCloudFrontSignedUrl = async (videoPath, expiresInSeconds = 3600) => {
  try {
    const privateKeyPath = process.env.CLOUDFRONT_PRIVATE_KEY_PATH;
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    const cloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;

    if (!privateKeyPath || !keyPairId || !cloudFrontDomain) {
      throw new Error('CloudFront configuration missing');
    }

    const privateKey = fs.readFileSync(path.resolve(privateKeyPath), 'utf8');
    
    // Create a simple signed URL using AWS SDK v3
    const policy = {
      Statement: [
        {
          Resource: `https://${cloudFrontDomain}/${videoPath}`,
          Condition: {
            DateLessThan: {
              'AWS:EpochTime': Math.floor(Date.now() / 1000) + expiresInSeconds
            }
          }
        }
      ]
    };

    const policyString = JSON.stringify(policy);
    const encodedPolicy = Buffer.from(policyString).toString('base64');
    const signature = crypto
      .createHmac('sha1', privateKey)
      .update(encodedPolicy)
      .digest('base64');

    const signedUrl = `https://${cloudFrontDomain}/${videoPath}?` +
      `Policy=${encodedPolicy}` +
      `&Signature=${signature}` +
      `&Key-Pair-Id=${keyPairId}`;

    return signedUrl;
  } catch (error) {
    console.error('Error generating CloudFront signed URL:', error);
    throw error;
  }
};

const deleteS3Object = async (key) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key
  });

  return s3Client.send(command);
};

module.exports = {
  generatePresignedUploadUrl,
  generateCloudFrontSignedUrl,
  deleteS3Object
};