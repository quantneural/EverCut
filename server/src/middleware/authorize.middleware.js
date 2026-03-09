import { ForbiddenError, UnauthorizedError } from '../utils/api-error.js';

/**
 * Authorization middleware — checks if the authenticated user has the required role.
 *
 * Usage:   router.get('/barber/profile', authenticate, authorize('BARBER'), controller);
 *
 * @param  {...string} allowedRoles – one or more role strings
 */
export const authorize = (...allowedRoles) => {
    return (req, _res, next) => {
        if (!req.user) {
            return next(new UnauthorizedError('Authentication required'));
        }

        if (req.user.isNewUser) {
            // New users can only access auth/registration endpoints
            return next(new ForbiddenError('Please complete your profile first'));
        }

        if (!allowedRoles.includes(req.user.roleType)) {
            return next(
                new ForbiddenError(
                    `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
                ),
            );
        }

        next();
    };
};
