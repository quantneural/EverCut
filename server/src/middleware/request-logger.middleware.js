import logger from '../utils/logger.js';

/**
 * Request logging middleware.
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Log on response finish
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
        };

        if (res.statusCode >= 400) {
            logger.warn('Request completed with error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
};

export default requestLogger;
