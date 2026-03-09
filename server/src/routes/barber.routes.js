import { Router } from 'express';
import authenticate from '../middleware/authenticate.middleware.js';
import { authorize } from '../middleware/authorize.middleware.js';
import {
    uploadEmployeePhoto,
    uploadShopCover,
    uploadShopPhotos,
} from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
    bookingIdParamSchema,
    bookingStatusSchema,
    bookingsByStatusQuerySchema,
} from '../validators/booking.validator.js';
import { objectIdParamSchema } from '../validators/common.validator.js';
import {
    addEmployeeSchema,
    employeeIdParamSchema,
    updateEmployeeSchema,
} from '../validators/employee.validator.js';
import { photoFilterQuerySchema, photoUploadSchema } from '../validators/photo.validator.js';
import { addReplySchema } from '../validators/rating.validator.js';
import { addServiceSchema, updateServiceSchema } from '../validators/service.validator.js';
import {
    toggleStatusSchema,
    updateBusinessSchema,
    updatePinSchema,
} from '../validators/shop.validator.js';
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

// Profile and shop
router.get('/profile', profileCtrl.getProfile);
router.put('/profile', validate(updateBusinessSchema, 'body'), shopCtrl.updateBusinessInfo);
router.put('/profile/pin', validate(updatePinSchema, 'body'), profileCtrl.updatePin);
router.put('/profile/cover', uploadShopCover, profileCtrl.updateCover);
router.put('/profile/toggle-status', validate(toggleStatusSchema, 'body'), shopCtrl.toggleShopStatus);

// Employees
router.get('/employees', employeeCtrl.getEmployees);
router.post('/employees', uploadEmployeePhoto, validate(addEmployeeSchema, 'body'), employeeCtrl.addEmployee);
router.put('/employees/:id', validate(employeeIdParamSchema, 'params'), validate(updateEmployeeSchema, 'body'), employeeCtrl.updateEmployee);
router.delete('/employees/:id', validate(employeeIdParamSchema, 'params'), employeeCtrl.deleteEmployee);

// Services
router.get('/services', serviceCtrl.getServices);
router.post('/services', validate(addServiceSchema, 'body'), serviceCtrl.addService);
router.put('/services/:id', validate(objectIdParamSchema, 'params'), validate(updateServiceSchema, 'body'), serviceCtrl.updateService);
router.delete('/services/:id', validate(objectIdParamSchema, 'params'), serviceCtrl.deleteService);

// Bookings
router.get('/bookings', bookingCtrl.getBookings);
router.get('/bookings/stats', bookingCtrl.getBookingStats);
router.get('/bookings/status', validate(bookingsByStatusQuerySchema, 'query'), bookingCtrl.getBookingsByStatus);
router.put('/bookings/:id/status', validate(bookingIdParamSchema, 'params'), validate(bookingStatusSchema, 'body'), bookingCtrl.updateBookingStatus);
router.delete('/bookings/:id', validate(bookingIdParamSchema, 'params'), bookingCtrl.deleteBooking);

// Photos
router.get('/photos', validate(photoFilterQuerySchema, 'query'), photoCtrl.getPhotos);
router.post('/photos', uploadShopPhotos, validate(photoUploadSchema, 'body'), photoCtrl.uploadPhotos);
router.get('/photos/stats', photoCtrl.getPhotoStats);
router.get('/photos/:id', validate(objectIdParamSchema, 'params'), photoCtrl.getPhotoById);
router.delete('/photos/:id', validate(objectIdParamSchema, 'params'), photoCtrl.deletePhoto);

// Earnings
router.get('/earnings', earningsCtrl.getEarnings);

// Ratings
router.get('/ratings', ratingCtrl.getRatings);
router.post('/ratings/:id/reply', validate(objectIdParamSchema, 'params'), validate(addReplySchema, 'body'), ratingCtrl.addReply);
router.put('/ratings/:id/reply', validate(objectIdParamSchema, 'params'), validate(addReplySchema, 'body'), ratingCtrl.updateReply);
router.delete('/ratings/:id/reply', validate(objectIdParamSchema, 'params'), ratingCtrl.deleteReply);
router.delete('/ratings/:id', validate(objectIdParamSchema, 'params'), earningsCtrl.removeRating);

export default router;
