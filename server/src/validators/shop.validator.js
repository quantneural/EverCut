import Joi from 'joi';
import { ALL_SHOP_CATEGORIES, DAYS_OF_WEEK } from '../utils/constants.js';

export const updateBusinessSchema = Joi.object({
    shopName: Joi.string().trim().min(1).max(100),
    ownerName: Joi.string().trim().min(1).max(100),
    numberOfEmployees: Joi.number().integer().min(1),
    yearsOfExperience: Joi.number().integer().min(0),
    emailId: Joi.string().email(),
    upiId: Joi.string(),
    bio: Joi.string().max(500).allow(''),
    address: Joi.string().trim(),
    category: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    facilities: Joi.array().items(Joi.string()),
    availableDays: Joi.array().items(Joi.string().valid(...DAYS_OF_WEEK)),
    openTime: Joi.string(),
    closeTime: Joi.string(),
    breakTimes: Joi.array().items(
        Joi.object({ start: Joi.string().required(), end: Joi.string().required() }),
    ),
    location: Joi.alternatives().try(
        Joi.object({
            type: Joi.string().valid('Point').required(),
            coordinates: Joi.array().items(Joi.number()).length(2).required(),
        }),
        Joi.string(),
    ),
}).min(1);

export const toggleStatusSchema = Joi.object({
    status: Joi.alternatives().try(Joi.boolean(), Joi.string()).optional(),
});

export const updatePinSchema = Joi.object({
    currentPin: Joi.string().required(),
    newPin: Joi.string().pattern(/^\d{4,6}$/).required(),
    confirmNewPin: Joi.string().required(),
});
