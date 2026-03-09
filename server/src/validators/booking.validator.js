import Joi from 'joi';
import { objectId, dateString, timeString } from './common.validator.js';

export const bookSalonSchema = Joi.object({
    shopId: objectId.required(),
    employeeId: objectId.required(),
    serviceId: Joi.alternatives().try(
        objectId,
        Joi.array().items(objectId).min(1),
    ).required(),
    date: dateString.required(),
    time: timeString.required(),
    amount: Joi.number().min(0).optional(),
});

export const rescheduleSchema = Joi.object({
    newDate: dateString.required(),
    newTime: timeString.required(),
});

export const reorderSchema = Joi.object({
    date: dateString.required(),
    time: timeString.required(),
});

export const updateBookingSchema = Joi.object({
    employeeId: objectId.required(),
    date: dateString.required(),
    time: timeString.required(),
});

export const bookingStatusSchema = Joi.object({
    status: Joi.string().valid('confirmed', 'completed', 'cancelled').required(),
});

export const customerBookingsQuerySchema = Joi.object({
    type: Joi.string().valid('past', 'upcoming', 'favorites').required(),
});

export const bookingIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const bookingServiceParamsSchema = Joi.object({
    id: objectId.required(),
    serviceId: objectId.required(),
});

export const employeeCalendarQuerySchema = Joi.object({
    date: dateString.required(),
});

export const bookingsByStatusQuerySchema = Joi.object({
    status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled').required(),
});
