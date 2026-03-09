import mongoose from 'mongoose';
import {
    ALL_BOOKING_STATUSES,
    ALL_PAYMENT_STATUSES,
    BOOKING_STATUS,
    PAYMENT_STATUS,
} from '../utils/constants.js';

/**
 * Booking model.
 *
 * Changes from old schema:
 *   - `userId`   → `customerId` (clearer naming)
 *   - `salonist` → `employeeId` (clearer naming)
 *   - `amount`   → `totalAmount`
 *   - Removed duplicate manual createdAt (let { timestamps: true } handle it)
 *   - Added proper composite indexes for query performance
 */
const bookingSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
            index: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        serviceIds: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Service',
                required: true,
            },
        ],
        date: {
            type: Date,
            required: true,
        },
        time: {
            type: String,
            required: true,
        },
        totalAmount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: ALL_BOOKING_STATUSES,
            default: BOOKING_STATUS.PENDING,
        },
        paymentStatus: {
            type: String,
            enum: ALL_PAYMENT_STATUSES,
            default: PAYMENT_STATUS.PENDING,
        },
        rescheduleCount: {
            type: Number,
            default: 0,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
bookingSchema.index({ customerId: 1, status: 1 });
bookingSchema.index({ shopId: 1, date: 1 });
bookingSchema.index({ employeeId: 1, date: 1, time: 1 });
bookingSchema.index({ customerId: 1, date: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
