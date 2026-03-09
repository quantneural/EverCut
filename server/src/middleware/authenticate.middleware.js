import admin from '../config/firebase.config.js';
import userRepository from '../repositories/user.repository.js';
import { UnauthorizedError } from '../utils/api-error.js';
import logger from '../utils/logger.js';

/**
 * Authenticate middleware — verifies Firebase ID token.
 *
 * On success, attaches to `req.user`:
 *   - _id            (MongoDB ObjectId)
 *   - firebaseUid
 *   - roleType       ('CUSTOMER' | 'BARBER' | 'ADMIN')
 *   - phoneNumber
 *   - email
 *
 * For new users (not yet in DB), attaches a minimal object:
 *   - firebaseUid
 *   - phoneNumber     (from the decoded Firebase token)
 *   - isNewUser: true
 */
const authenticate = async (req, _res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedError('No token provided');
        }

        const token = authHeader.split(' ')[1];
        if (!token) throw new UnauthorizedError('No token provided');

        // Verify Firebase ID token
        const decoded = await admin.auth().verifyIdToken(token);

        // Look up the user in our database
        const user = await userRepository.findByFirebaseUid(decoded.uid);

        if (user) {
            req.user = {
                _id: user._id,
                firebaseUid: user.firebaseUid,
                roleType: user.roleType,
                phoneNumber: user.phoneNumber,
                email: user.email,
            };
        } else {
            // New user — hasn't completed registration yet
            req.user = {
                firebaseUid: decoded.uid,
                phoneNumber: decoded.phone_number,
                isNewUser: true,
            };
        }

        next();
    } catch (err) {
        if (err instanceof UnauthorizedError) return next(err);
        logger.warn('Token verification failed', { error: err.message });
        next(new UnauthorizedError('Invalid or expired token'));
    }
};

export default authenticate;
