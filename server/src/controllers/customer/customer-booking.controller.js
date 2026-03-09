import * as bookingService from '../../services/booking.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const bookSalon = async (req, res, next) => {
    try {
        const result = await bookingService.bookSalon(req.user._id, req.body);
        return res.status(201).json(ApiResponse.success(result, 'Booking confirmed'));
    } catch (err) {
        next(err);
    }
};

export const getBookings = async (req, res, next) => {
    try {
        const { type } = req.query;
        const bookings = await bookingService.getCustomerBookings(req.user._id, type);
        return res.status(200).json(ApiResponse.success(bookings, 'Bookings fetched'));
    } catch (err) {
        next(err);
    }
};

export const getBookingDetails = async (req, res, next) => {
    try {
        const result = await bookingService.getBookingDetails(req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Booking details fetched'));
    } catch (err) {
        next(err);
    }
};

export const cancelBooking = async (req, res, next) => {
    try {
        const result = await bookingService.cancelBooking(req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Booking cancelled'));
    } catch (err) {
        next(err);
    }
};

export const rescheduleBooking = async (req, res, next) => {
    try {
        const { newDate, newTime } = req.body;
        const result = await bookingService.rescheduleBooking(req.params.id, newDate, newTime);
        return res.status(200).json(ApiResponse.success(result, 'Booking rescheduled'));
    } catch (err) {
        next(err);
    }
};

export const reorderBooking = async (req, res, next) => {
    try {
        const { date, time } = req.body;
        const result = await bookingService.reorderBooking(req.user._id, req.params.id, date, time);
        return res.status(201).json(ApiResponse.success(result, 'Booking re-ordered'));
    } catch (err) {
        next(err);
    }
};

export const toggleFavorite = async (req, res, next) => {
    try {
        const result = await bookingService.addToFavorites(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Favorite updated'));
    } catch (err) {
        next(err);
    }
};

export const getBookingConfirmation = async (req, res, next) => {
    try {
        const result = await bookingService.getBookingConfirmation(req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Confirmation fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateBooking = async (req, res, next) => {
    try {
        const result = await bookingService.updateBooking(req.params.id, req.body);
        return res.status(200).json(ApiResponse.success(result, 'Booking updated'));
    } catch (err) {
        next(err);
    }
};

export const deleteServiceFromBooking = async (req, res, next) => {
    try {
        const result = await bookingService.deleteServiceFromBooking(req.params.id, req.params.serviceId);
        return res.status(200).json(ApiResponse.success(result, 'Service removed from booking'));
    } catch (err) {
        next(err);
    }
};

export const getEmployeeCalendar = async (req, res, next) => {
    try {
        const result = await bookingService.getEmployeeCalendar(req.params.id, req.query.date);
        return res.status(200).json(ApiResponse.success(result, 'Calendar fetched'));
    } catch (err) {
        next(err);
    }
};
