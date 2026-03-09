import Joi from 'joi';
import { ALL_GENDERS, ALL_SHOP_CATEGORIES, DAYS_OF_WEEK } from '../utils/constants.js';
import { locationSchema } from './common.validator.js';

export const customerOnboardingSchema = Joi.object({
    phoneNumber: Joi.string().required(),
    email: Joi.string().email().required(),
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    gender: Joi.string().valid(...ALL_GENDERS).required(),
    dateOfBirth: Joi.date().required(),
    address: Joi.string().trim().required(),
    location: Joi.alternatives().try(locationSchema, Joi.string()).required(),
});

export const barberOnboardingSchema = Joi.object({
    phoneNumber: Joi.string().required(),
    emailId: Joi.string().email().required(),
    shopName: Joi.string().trim().min(1).max(100).required(),
    shopOwner: Joi.string().trim().min(1).max(100).required(),
    shopCategory: Joi.string().valid(...ALL_SHOP_CATEGORIES).required(),
    upiId: Joi.string().required(),
    bio: Joi.string().max(500).allow('').default(''),
    address: Joi.string().trim().required(),
    location: Joi.alternatives().try(locationSchema, Joi.string()).required(),
    numberOfEmployees: Joi.number().integer().min(1).required(),
    yearsOfExperience: Joi.number().integer().min(0).required(),
    facilities: Joi.array().items(Joi.string()).default([]),
    availableDays: Joi.array().items(Joi.string().valid(...DAYS_OF_WEEK)).required(),
    openTime: Joi.string().required(),
    closeTime: Joi.string().required(),
    breakTimes: Joi.array().items(
        Joi.object({ start: Joi.string().required(), end: Joi.string().required() }),
    ).default([]),
    pin: Joi.string().pattern(/^\d{4,6}$/).required(),
    confirmPin: Joi.string().required(),
});
