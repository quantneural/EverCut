import Joi from 'joi';
import { ALL_GENDERS } from '../utils/constants.js';
import { objectId } from './common.validator.js';

export const addEmployeeSchema = Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required(),
    lastName: Joi.string().trim().min(1).max(50).required(),
    phoneNumber: Joi.string().required(),
    gender: Joi.string().valid(...ALL_GENDERS).required(),
    dateOfBirth: Joi.date().required(),
    workingHours: Joi.alternatives().try(
        Joi.object({
            start: Joi.string().required(),
            end: Joi.string().required(),
        }),
        Joi.string(),
    ),
    blockedDates: Joi.array().items(Joi.date()).default([]),
});

export const updateEmployeeSchema = Joi.object({
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    phoneNumber: Joi.string(),
    gender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date(),
    workingHours: Joi.alternatives().try(
        Joi.object({
            start: Joi.string(),
            end: Joi.string(),
        }),
        Joi.string(),
    ),
    blockedDates: Joi.alternatives().try(Joi.array().items(Joi.date()), Joi.string()),
});

export const employeeIdParamSchema = Joi.object({
    id: objectId.required(),
});
