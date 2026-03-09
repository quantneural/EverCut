import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { uploadCustomerPhoto } from '../middleware/upload.middleware.js';
import { ROLES } from '../utils/constants.js';

// Controllers
import * as profileCtrl from '../controllers/customer/customer-profile.controller.js';
import * as bookingCtrl from '../controllers/customer/customer-booking.controller.js';
import * as shopCtrl from '../controllers/customer/customer-shop.controller.js';
import * as ratingCtrl from '../controllers/customer/customer-rating.controller.js';

const router = Router();

// All routes require authentication + CUSTOMER role
router.use(authenticate, authorize(ROLES.CUSTOMER));

// ── Profile ──────────────────────────────────────────────────────────────
router.get('/profile', profileCtrl.getProfile);
router.put('/profile', uploadCustomerPhoto, profileCtrl.updateProfile);

// ── Homepage ─────────────────────────────────────────────────────────────
router.get('/homepage', profileCtrl.getHomeProfile);
router.get('/homepage/services', shopCtrl.getServicesByGender);

// ── Bookings ─────────────────────────────────────────────────────────────
router.get('/bookings', bookingCtrl.getBookings);
router.post('/bookings', bookingCtrl.bookSalon);
router.get('/bookings/:id', bookingCtrl.getBookingDetails);
router.delete('/bookings/:id', bookingCtrl.cancelBooking);
router.put('/bookings/:id/reschedule', bookingCtrl.rescheduleBooking);
router.post('/bookings/:id/reorder', bookingCtrl.reorderBooking);
router.put('/bookings/:id/favorite', bookingCtrl.toggleFavorite);
router.get('/bookings/:id/confirmation', bookingCtrl.getBookingConfirmation);
router.put('/bookings/:id', bookingCtrl.updateBooking);
router.delete('/bookings/:id/services/:serviceId', bookingCtrl.deleteServiceFromBooking);

// ── Shop Discovery ───────────────────────────────────────────────────────
router.get('/shops/nearby', shopCtrl.getNearbyShops);
router.get('/shops/doorstep', shopCtrl.getDoorstepShops);
router.get('/shops/:id', shopCtrl.getShopInfo);

// ── Search ───────────────────────────────────────────────────────────────
router.get('/search/services', shopCtrl.searchServices);
router.get('/search/shops', shopCtrl.searchShops);

// ── Ratings ──────────────────────────────────────────────────────────────
router.post('/ratings', ratingCtrl.addRating);
router.get('/shops/:id/ratings', ratingCtrl.getRatingsByShop);
router.get('/shops/:id/ratings/summary', ratingCtrl.getRatingSummary);

// ── Employee Calendar ────────────────────────────────────────────────────
router.get('/employees/:id/calendar', bookingCtrl.getEmployeeCalendar);

export default router;
