import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { uploadCustomerPhoto } from '../middleware/upload.middleware.js';
import {
    bookSalonSchema,
    bookingIdParamSchema,
    bookingServiceParamsSchema,
    customerBookingsQuerySchema,
    employeeCalendarQuerySchema,
    reorderSchema,
    rescheduleSchema,
    updateBookingSchema,
} from '../validators/booking.validator.js';
import { employeeIdParamSchema } from '../validators/employee.validator.js';
import { addRatingSchema } from '../validators/rating.validator.js';
import {
    nearbyShopsQuerySchema,
    searchServicesQuerySchema,
    searchShopsQuerySchema,
    servicesByGenderQuerySchema,
    shopIdParamSchema,
} from '../validators/shop.validator.js';
import { updateCustomerProfileSchema } from '../validators/customer.validator.js';
import { ROLES } from '../utils/constants.js';

// Controllers
import * as profileCtrl from '../controllers/customer/customer-profile.controller.js';
import * as bookingCtrl from '../controllers/customer/customer-booking.controller.js';
import * as shopCtrl from '../controllers/customer/customer-shop.controller.js';
import * as ratingCtrl from '../controllers/customer/customer-rating.controller.js';

const router = Router();

// All routes require authentication + CUSTOMER role
router.use(authenticate, authorize(ROLES.CUSTOMER));

// Profile
router.get('/profile', profileCtrl.getProfile);
router.put('/profile', uploadCustomerPhoto, validate(updateCustomerProfileSchema, 'body'), profileCtrl.updateProfile);

// Homepage
router.get('/homepage', profileCtrl.getHomeProfile);
router.get('/homepage/services', validate(servicesByGenderQuerySchema, 'query'), shopCtrl.getServicesByGender);

// Bookings
router.get('/bookings', validate(customerBookingsQuerySchema, 'query'), bookingCtrl.getBookings);
router.post('/bookings', validate(bookSalonSchema, 'body'), bookingCtrl.bookSalon);
router.get('/bookings/:id', validate(bookingIdParamSchema, 'params'), bookingCtrl.getBookingDetails);
router.delete('/bookings/:id', validate(bookingIdParamSchema, 'params'), bookingCtrl.cancelBooking);
router.put('/bookings/:id/reschedule', validate(bookingIdParamSchema, 'params'), validate(rescheduleSchema, 'body'), bookingCtrl.rescheduleBooking);
router.post('/bookings/:id/reorder', validate(bookingIdParamSchema, 'params'), validate(reorderSchema, 'body'), bookingCtrl.reorderBooking);
router.put('/bookings/:id/favorite', validate(bookingIdParamSchema, 'params'), bookingCtrl.toggleFavorite);
router.get('/bookings/:id/confirmation', validate(bookingIdParamSchema, 'params'), bookingCtrl.getBookingConfirmation);
router.put('/bookings/:id', validate(bookingIdParamSchema, 'params'), validate(updateBookingSchema, 'body'), bookingCtrl.updateBooking);
router.delete('/bookings/:id/services/:serviceId', validate(bookingServiceParamsSchema, 'params'), bookingCtrl.deleteServiceFromBooking);

// Shop discovery
router.get('/shops/nearby', validate(nearbyShopsQuerySchema, 'query'), shopCtrl.getNearbyShops);
router.get('/shops/doorstep', shopCtrl.getDoorstepShops);
router.get('/shops/:id', validate(shopIdParamSchema, 'params'), shopCtrl.getShopInfo);

// Search
router.get('/search/services', validate(searchServicesQuerySchema, 'query'), shopCtrl.searchServices);
router.get('/search/shops', validate(searchShopsQuerySchema, 'query'), shopCtrl.searchShops);

// Ratings
router.post('/ratings', validate(addRatingSchema, 'body'), ratingCtrl.addRating);
router.get('/shops/:id/ratings', validate(shopIdParamSchema, 'params'), ratingCtrl.getRatingsByShop);
router.get('/shops/:id/ratings/summary', validate(shopIdParamSchema, 'params'), ratingCtrl.getRatingSummary);

// Employee calendar
router.get('/employees/:id/calendar', validate(employeeIdParamSchema, 'params'), validate(employeeCalendarQuerySchema, 'query'), bookingCtrl.getEmployeeCalendar);

export default router;
