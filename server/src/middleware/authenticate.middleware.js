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
 *   - email
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
        const decoded = await admin.auth().verifyIdToken(token, true);

        // Look up the user in our database, including soft-deleted records
        const user = await userRepository.findByFirebaseUid(decoded.uid, { includeDeleted: true });

        if (user?.deletedAt || user?.isActive === false) {
            return next(new UnauthorizedError('This account has been deleted. Please contact support if this is unexpected.'));
        }

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
                email: decoded.email || null,
                isNewUser: true,
            };
        }

        next();
    } catch (err) {
        if (err instanceof UnauthorizedError) return next(err);
        if (['auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(err.code)) {
            return next(new UnauthorizedError('Session is no longer valid. Please sign in again.'));
        }
        logger.warn('Token verification failed', { error: err.message });
        next(new UnauthorizedError('Invalid or expired token'));
    }
};

export default authenticate;
