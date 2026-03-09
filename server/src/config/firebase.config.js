import admin from 'firebase-admin';
import path from 'path';
import { readFileSync } from 'fs';
import config from './index.js';
import logger from '../utils/logger.js';

/**
 * Initialise Firebase Admin SDK (singleton).
 * The service-account key file path is read from config.
 */
const initFirebase = () => {
    if (admin.apps.length > 0) {
        return admin; // already initialised
    }

    try {
        const keyPath = path.resolve(
            process.cwd(),
            config.firebase.serviceAccountPath.split('#')[0].trim()
        );

        const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf-8'));

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        logger.info('✅ Firebase Admin SDK initialised');
    } catch (err) {
        logger.error('❌ Firebase Admin SDK init failed', { error: err.message });
        throw err;
    }

    return admin;
};

export default initFirebase();
