import * as bookingService from '../../services/booking.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const getBookings = async (req, res, next) => {
    try {
        const result = await bookingService.getBookingsByShop(req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Shop bookings fetched'));
    } catch (err) {
        next(err);
    }
};

export const getBookingStats = async (req, res, next) => {
    try {
        const stats = await bookingService.getBookingStats(req.user._id);
        return res.status(200).json(ApiResponse.success(stats, 'Booking stats'));
    } catch (err) {
        next(err);
    }
};

export const updateBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const booking = await bookingService.updateBookingStatus(req.params.id, status);
        return res.status(200).json(ApiResponse.success(booking, 'Status updated'));
    } catch (err) {
        next(err);
    }
};

export const deleteBooking = async (req, res, next) => {
    try {
        const result = await bookingService.deleteBookingAfterPayment(req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Booking deleted'));
    } catch (err) {
        next(err);
    }
};

export const getBookingsByStatus = async (req, res, next) => {
    try {
        const { status } = req.query;
        const bookings = await bookingService.getBookingsByStatusDetailed(req.user._id, status);
        return res.status(200).json(ApiResponse.success(bookings, `Bookings with status: ${status}`));
    } catch (err) {
        next(err);
    }
};
