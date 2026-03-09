import * as onboardingService from '../services/onboarding.service.js';
import { ApiResponse } from '../utils/api-response.js';

/**
 * Onboarding controller - handles first-time profile creation for both roles.
 */
export const createCustomerOnboarding = async (req, res, next) => {
    try {
        const { firebaseUid } = req.user;
        const result = await onboardingService.createCustomerOnboarding(firebaseUid, req.body, req.file);
        return res.status(201).json(ApiResponse.success(result, 'Customer profile created'));
    } catch (err) {
        next(err);
    }
};

export const createBarberOnboarding = async (req, res, next) => {
    try {
        const { firebaseUid } = req.user;
        const result = await onboardingService.createBarberOnboarding(firebaseUid, req.user, req.body, req.files);
        return res.status(201).json(ApiResponse.success(result, 'Barber profile created'));
    } catch (err) {
        next(err);
    }
};
