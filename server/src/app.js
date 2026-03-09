import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import routes from './routes/index.js';
import requestLogger from './middleware/request-logger.middleware.js';
import errorHandler from './middleware/error-handler.middleware.js';
import { ApiResponse } from './utils/api-response.js';

/**
 * Express application factory.
 *
 * Middleware stack order follows the Blueprint:
 *  1. Request Logger
 *  2. CORS
 *  3. Body Parser (with size limits)
 *  4. Routes
 *  5. 404 handler
 *  6. Global error handler
 */
const createApp = () => {
    const app = express();

    // ── 1. Request logging ─────────────────────────────────────────────────
    app.use(requestLogger);

    // ── 2. CORS ────────────────────────────────────────────────────────────
    app.use(
        cors({
            origin: config.env === 'production'
                ? process.env.ALLOWED_ORIGINS?.split(',') || []
                : '*',
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            allowedHeaders: ['Content-Type', 'Authorization'],
        }),
    );

    // ── 3. Body parsing ────────────────────────────────────────────────────
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // ── 4. API routes ──────────────────────────────────────────────────────
    app.use(config.apiPrefix, routes);

    // ── 5. 404 catch-all ───────────────────────────────────────────────────
    app.use((_req, res) => {
        res.status(404).json(
            ApiResponse.error('Route not found', 404),
        );
    });

    // ── 6. Global error handler (must be last) ─────────────────────────────
    app.use(errorHandler);

    return app;
};

export default createApp;
