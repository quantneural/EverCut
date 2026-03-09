import mongoose from 'mongoose';
import config from './index.js';
import logger from '../utils/logger.js';

/**
 * Connect to MongoDB with sensible defaults and security hardening.
 *
 * Security notes:
 *   - NEVER log the connection URI (contains credentials)
 *   - Enable Mongoose sanitizeFilter to prevent query selector injection
 *   - Proper pool sizing and timeouts for production resilience
 */
const connectDB = async () => {
    try {
        logger.info('Connecting to MongoDB…');  // ✅ No URI in log

        // Enable Mongoose-level query filter sanitisation globally.
        // This prevents query injection via $gt/$ne operators even if
        // express-mongo-sanitize is bypassed or inputs arrive via
        // non-HTTP channels (cron jobs, queue consumers, etc.).
        mongoose.set('sanitizeFilter', true);

        await mongoose.connect(config.mongo.uri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 10_000,
            socketTimeoutMS: 45_000,
        });

        logger.info('MongoDB connected successfully', {
            dbName: mongoose.connection.name,
        });

        // Log disconnections / errors at runtime (never log the URI)
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB runtime error', { error: err.message });
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });

        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });
    } catch (err) {
        logger.error('MongoDB connection failed', { error: err.message });  // ❌ Never log `uri`
        process.exit(1);
    }
};

/**
 * Gracefully close the MongoDB connection.
 */
export const disconnectDB = async () => {
    try {
        await mongoose.disconnect();
        logger.info('MongoDB disconnected gracefully');
    } catch (err) {
        logger.error('Error disconnecting MongoDB', { error: err.message });
    }
};

export default connectDB;
