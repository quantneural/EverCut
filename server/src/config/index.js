import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root (one level above src/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read an env var and throw immediately if it is required and missing.
 */
const requireEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Read an optional env var with a default.
 */
const optionalEnv = (key, fallback) => process.env[key] || fallback;

// ---------------------------------------------------------------------------
// Config Object
// ---------------------------------------------------------------------------

const config = Object.freeze({
  /** Application */
  env: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '5001'), 10),
  apiPrefix: '/api/v1',

  /** MongoDB */
  mongo: Object.freeze({
    uri: requireEnv('MONGODB_URI'),
  }),

  /** Firebase */
  firebase: Object.freeze({
    projectId: requireEnv('FIREBASE_PROJECT_ID'),
    clientEmail: requireEnv('FIREBASE_CLIENT_EMAIL'),
    privateKey: requireEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
  }),

  /** Cloudinary */
  cloudinary: Object.freeze({
    cloudName: requireEnv('CLOUDINARY_CLOUD_NAME'),
    apiKey: requireEnv('CLOUDINARY_API_KEY'),
    apiSecret: requireEnv('CLOUDINARY_API_SECRET'),
  }),

  /** Upload limits */
  upload: Object.freeze({
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    maxFiles: 10,
    allowedImageFormats: ['jpg', 'jpeg', 'png', 'webp'],
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ],
  }),

  /** Security / Rate Limiting */
  security: Object.freeze({
    bcryptSaltRounds: 10,
    rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
    rateLimitMax: 100, // requests per window
  }),

  /** Pagination defaults */
  pagination: Object.freeze({
    defaultPage: 1,
    defaultLimit: 20,
    maxLimit: 100,
  }),
});

export default config;
