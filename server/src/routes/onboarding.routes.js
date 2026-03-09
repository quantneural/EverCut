import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { uploadCustomerPhoto } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
    customerOnboardingSchema,
    barberOnboardingSchema,
} from '../validators/auth.validator.js';
import * as onboardingController from '../controllers/onboarding.controller.js';

const router = Router();

/**
 * POST /api/v1/onboarding/customers
 * Create customer profile after authentication.
 */
router.post(
    '/customers',
    authenticate,
    uploadCustomerPhoto,
    validate(customerOnboardingSchema, 'body'),
    onboardingController.createCustomerOnboarding,
);

/**
 * POST /api/v1/onboarding/barbers
 * Create barber/shop profile after authentication.
 */
router.post(
    '/barbers',
    authenticate,
    validate(barberOnboardingSchema, 'body'),
    onboardingController.createBarberOnboarding,
);

export default router;
