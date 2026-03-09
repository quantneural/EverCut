import * as authService from '../services/auth.service.js';
import { ApiResponse } from '../utils/api-response.js';

/**
 * Auth controller - handles session bootstrap after Firebase auth.
 */
export const createSession = async (req, res, next) => {
    try {
        const { firebaseUid, phoneNumber } = req.user;
        const result = await authService.createSession(firebaseUid, phoneNumber);

        if (result.isNewUser) {
            return res.status(200).json(
                ApiResponse.success(
                    { isNewUser: true, firebaseUid: result.firebaseUid, phoneNumber: result.phoneNumber },
                    'New user. Please complete your profile.',
                ),
            );
        }

        return res.status(200).json(
            ApiResponse.success(
                { isNewUser: false, user: result.user, profile: result.profile },
                'Login successful',
            ),
        );
    } catch (err) {
        next(err);
    }
};
