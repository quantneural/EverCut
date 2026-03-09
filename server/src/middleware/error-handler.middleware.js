import { AppError } from '../utils/api-error.js';
import { ApiResponse } from '../utils/api-response.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';

/**
 * Global Express error-handling middleware.
 *
 * Must be the LAST app.use() call so it catches everything.
 * Handles operational errors (expected) differently from programmer bugs.
 */

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
    // -----------------------------------------------------------------------
    // 1. Multer-specific errors
    // -----------------------------------------------------------------------
    if (err.name === 'MulterError') {
        const messages = {
            LIMIT_FILE_SIZE: 'File too large. Maximum size is 5 MB.',
            LIMIT_FILE_COUNT: 'Too many files uploaded.',
            LIMIT_UNEXPECTED_FILE: 'Unexpected file field.',
        };
        const message = messages[err.code] || 'File upload error';
        return res.status(400).json(ApiResponse.error(message, 400));
    }

    // -----------------------------------------------------------------------
    // 2. Mongoose ValidationError
    // -----------------------------------------------------------------------
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map((e) => e.message);
        return res
            .status(400)
            .json(ApiResponse.error('Validation failed', 400, errors));
    }

    // -----------------------------------------------------------------------
    // 3. Mongoose duplicate-key error (code 11000)
    // -----------------------------------------------------------------------
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {}).join(', ');
        return res
            .status(409)
            .json(ApiResponse.error(`Duplicate value for: ${field}`, 409));
    }

    // -----------------------------------------------------------------------
    // 4. Mongoose CastError (e.g. invalid ObjectId)
    // -----------------------------------------------------------------------
    if (err.name === 'CastError') {
        return res
            .status(400)
            .json(ApiResponse.error(`Invalid ${err.path}: ${err.value}`, 400));
    }

    // -----------------------------------------------------------------------
    // 5. Our custom AppError hierarchy (operational errors)
    // -----------------------------------------------------------------------
    if (err instanceof AppError) {
        return res
            .status(err.statusCode)
            .json(ApiResponse.error(err.message, err.statusCode, err.errors));
    }

    // -----------------------------------------------------------------------
    // 6. Unexpected / programmer errors
    // -----------------------------------------------------------------------
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
    });

    const message =
        config.env === 'production'
            ? 'Internal server error'
            : err.message || 'Internal server error';

    return res.status(500).json(ApiResponse.error(message, 500));
};

export default errorHandler;
