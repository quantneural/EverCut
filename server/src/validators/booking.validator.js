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
    status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled').required(),
});
