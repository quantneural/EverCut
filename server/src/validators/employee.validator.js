import Joi from 'joi';
import { ALL_GENDERS } from '../utils/constants.js';

export const addEmployeeSchema = Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    phoneNumber: Joi.string().required(),
    gender: Joi.string().valid(...ALL_GENDERS).required(),
    dateOfBirth: Joi.date().required(),
    blockedDates: Joi.array().items(Joi.date()).default([]),
});

export const updateEmployeeSchema = Joi.object({
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    phoneNumber: Joi.string(),
    gender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date(),
    workingHours: Joi.object({
        start: Joi.string(),
        end: Joi.string(),
    }),
    blockedDates: Joi.array().items(Joi.date()),
}).min(1);
