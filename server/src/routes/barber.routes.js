import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import {
    uploadEmployeePhoto,
    uploadShopCover,
    uploadShopPhotos,
} from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { addReplySchema } from '../validators/rating.validator.js';
import { ROLES } from '../utils/constants.js';

// Controllers
import * as shopCtrl from '../controllers/barber/barber-shop.controller.js';
import * as profileCtrl from '../controllers/barber/barber-profile.controller.js';
import * as employeeCtrl from '../controllers/barber/barber-employee.controller.js';
import * as serviceCtrl from '../controllers/barber/barber-service.controller.js';
import * as bookingCtrl from '../controllers/barber/barber-booking.controller.js';
import * as photoCtrl from '../controllers/barber/barber-photo.controller.js';
import * as earningsCtrl from '../controllers/barber/barber-earnings.controller.js';
import * as ratingCtrl from '../controllers/barber/barber-rating.controller.js';

const router = Router();

// All routes require authentication + BARBER role
router.use(authenticate, authorize(ROLES.BARBER));

// ── Profile & Shop ──────────────────────────────────────────────────────
router.get('/profile', profileCtrl.getProfile);
router.put('/profile', shopCtrl.updateBusinessInfo);
router.put('/profile/pin', profileCtrl.updatePin);
router.put('/profile/cover', uploadShopCover, profileCtrl.updateCover);
router.put('/profile/toggle-status', shopCtrl.toggleShopStatus);

// ── Employees ────────────────────────────────────────────────────────────
router.get('/employees', employeeCtrl.getEmployees);
router.post('/employees', uploadEmployeePhoto, employeeCtrl.addEmployee);
router.put('/employees/:id', employeeCtrl.updateEmployee);
router.delete('/employees/:id', employeeCtrl.deleteEmployee);

// ── Services ─────────────────────────────────────────────────────────────
router.get('/services', serviceCtrl.getServices);
router.post('/services', serviceCtrl.addService);
router.put('/services/:id', serviceCtrl.updateService);
router.delete('/services/:id', serviceCtrl.deleteService);

// ── Bookings ─────────────────────────────────────────────────────────────
router.get('/bookings', bookingCtrl.getBookings);
router.get('/bookings/stats', bookingCtrl.getBookingStats);
router.get('/bookings/status', bookingCtrl.getBookingsByStatus);
router.put('/bookings/:id/status', bookingCtrl.updateBookingStatus);
router.delete('/bookings/:id', bookingCtrl.deleteBooking);

// ── Photos ───────────────────────────────────────────────────────────────
router.get('/photos', photoCtrl.getPhotos);
router.post('/photos', uploadShopPhotos, photoCtrl.uploadPhotos);
router.get('/photos/stats', photoCtrl.getPhotoStats);
router.get('/photos/:id', photoCtrl.getPhotoById);
router.delete('/photos/:id', photoCtrl.deletePhoto);

// ── Earnings ─────────────────────────────────────────────────────────────
router.get('/earnings', earningsCtrl.getEarnings);

// ── Ratings ──────────────────────────────────────────────────────────────
router.get('/ratings', ratingCtrl.getRatings);
router.post('/ratings/:id/reply', validate(addReplySchema, 'body'), ratingCtrl.addReply);
router.put('/ratings/:id/reply', validate(addReplySchema, 'body'), ratingCtrl.updateReply);
router.delete('/ratings/:id/reply', ratingCtrl.deleteReply);
router.delete('/ratings/:id', earningsCtrl.removeRating);

export default router;
