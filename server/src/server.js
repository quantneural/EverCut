import config from './config/index.js';
import connectDB, { disconnectDB } from './config/database.config.js';
import createApp from './app.js';
import logger from './utils/logger.js';

/**
 * Start the server.
 */
const start = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Create Express app
        const app = createApp();

        // Start HTTP server
        const server = app.listen(config.port, () => {
            logger.info(`🚀 EverCut API running on port ${config.port}`, {
                env: config.env,
                apiPrefix: config.apiPrefix,
            });
        });

        // ── Graceful shutdown ────────────────────────────────────────────────
        const shutdown = async (signal) => {
            logger.info(`${signal} received. Shutting down gracefully…`);

            server.close(async () => {
                await disconnectDB();
                logger.info('Server closed');
                process.exit(0);
            });

            // Force shutdown after 10 seconds
            setTimeout(() => {
                logger.error('Forced shutdown after timeout');
                process.exit(1);
            }, 10_000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Catch unhandled rejections / exceptions
        process.on('unhandledRejection', (reason) => {
            logger.error('Unhandled rejection', { error: reason?.message || reason });
        });

        process.on('uncaughtException', (err) => {
            logger.error('Uncaught exception', { error: err.message, stack: err.stack });
            process.exit(1);
        });
    } catch (err) {
        logger.error('Failed to start server', { error: err.message });
        process.exit(1);
    }
};

start();
