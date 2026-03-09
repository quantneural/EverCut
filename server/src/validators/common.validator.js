import Joi from 'joi';
import mongoose from 'mongoose';

/**
 * Common reusable validation rules.
 */

// Custom ObjectId validator
export const objectId = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
}, 'ObjectId validation');

// Pagination
export const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
});

// Date string (YYYY-MM-DD)
export const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

// Time string (hh:mm AM/PM)
export const timeString = Joi.string().pattern(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s(AM|PM)$/i);

// Location GeoJSON
export const locationSchema = Joi.object({
    type: Joi.string().valid('Point').required(),
    coordinates: Joi.array().items(Joi.number()).length(2).required(),
});

// Generic :id route params
export const objectIdParamSchema = Joi.object({
    id: objectId.required(),
});
