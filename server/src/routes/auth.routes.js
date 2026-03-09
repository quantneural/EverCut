import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { sessionSchema } from '../validators/auth.validator.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

/**
 * POST /api/v1/auth/session
 * Create auth session context after Firebase token verification.
 */
router.post('/session', authenticate, validate(sessionSchema, 'body'), authController.createSession);

export default router;
