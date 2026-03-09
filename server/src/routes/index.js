import { Router } from 'express';
import authRoutes from './auth.routes.js';
import onboardingRoutes from './onboarding.routes.js';
import customerRoutes from './customer.routes.js';
import barberRoutes from './barber.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/onboarding', onboardingRoutes);
router.use('/customer', customerRoutes);
router.use('/barber', barberRoutes);

// Health check
router.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'EverCut API is running',
        timestamp: new Date().toISOString(),
    });
});

export default router;
