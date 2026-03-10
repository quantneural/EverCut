import admin from 'firebase-admin';
import config from './index.js';
import logger from '../utils/logger.js';

/**
 * Initialise Firebase Admin SDK (singleton).
 * The service-account credentials are read from environment variables.
 */
const initFirebase = () => {
  if (admin.apps.length > 0) {
    return admin;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(config.firebase),
    });

    logger.info('Firebase Admin SDK initialised', {
      projectId: config.firebase.projectId,
    });
  } catch (err) {
    logger.error('Firebase Admin SDK init failed', { error: err.message });
    throw err;
  }

  return admin;
};

export default initFirebase();
