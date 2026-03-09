import Joi from 'joi';
import { ALL_GENDERS } from '../utils/constants.js';
import { locationSchema } from './common.validator.js';

export const updateCustomerProfileSchema = Joi.object({
    email: Joi.string().email(),
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    gender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date(),
    address: Joi.string().trim(),
    location: Joi.alternatives().try(locationSchema, Joi.string()),
}).min(1);
