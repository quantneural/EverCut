import Joi from 'joi';
import {
    ALL_GENDERS,
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    ALL_SHOP_CATEGORIES,
    DAYS_OF_WEEK,
    SECURITY_PIN_LENGTH,
} from '../utils/constants.js';
import { locationSchema } from './common.validator.js';

const daysSchema = Joi.alternatives().try(
    Joi.array().items(Joi.string().valid(...DAYS_OF_WEEK)),
    Joi.string(),
);

const amenitiesSchema = Joi.alternatives().try(
    Joi.array().items(Joi.string().valid(...ALL_SHOP_AMENITIES)),
    Joi.string(),
);

const breakTimesSchema = Joi.alternatives().try(
    Joi.array().items(
        Joi.object({
            start: Joi.string(),
            end: Joi.string(),
            startsAt: Joi.string(),
            endsAt: Joi.string(),
        }),
    ),
    Joi.string(),
);

const targetCustomersSchema = Joi.string().valid(...ALL_SERVICE_FOR, 'men', 'women');

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
    email: Joi.string().email(),
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    ownerFirstName: Joi.string().trim().min(1).max(50),
    ownerLastName: Joi.string().trim().min(1).max(50),
    gender: Joi.string().valid(...ALL_GENDERS),
    ownerGender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date(),
    ownerDateOfBirth: Joi.date(),
    shopName: Joi.string().trim().min(1).max(100).required(),
    shopOwner: Joi.string().trim().min(1).max(100),
    ownerName: Joi.string().trim().min(1).max(100),
    shopCategory: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    businessCategory: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    category: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    targetCustomers: targetCustomersSchema.required(),
    upiId: Joi.string(),
    upiAddress: Joi.string(),
    accountHolderName: Joi.string().trim().min(1).max(100).required(),
    bankName: Joi.string().trim().min(1).max(120).required(),
    bio: Joi.string().max(500).allow('').default(''),
    address: Joi.string().trim(),
    shopLocation: Joi.string().trim(),
    location: Joi.alternatives().try(locationSchema, Joi.string()).required(),
    numberOfEmployees: Joi.number().integer().min(1).default(1),
    yearsOfExperience: Joi.number().integer().min(0).default(0),
    facilities: amenitiesSchema,
    amenities: amenitiesSchema,
    availableDays: daysSchema,
    workingDays: daysSchema,
    openTime: Joi.string(),
    closeTime: Joi.string(),
    opensAt: Joi.string(),
    closesAt: Joi.string(),
    workingHours: Joi.alternatives().try(
        Joi.object({
            openTime: Joi.string(),
            closeTime: Joi.string(),
            opensAt: Joi.string(),
            closesAt: Joi.string(),
        }),
        Joi.string(),
    ),
    breakTimes: breakTimesSchema,
    breakTimings: breakTimesSchema,
    pin: Joi.string().pattern(new RegExp(`^\\d{${SECURITY_PIN_LENGTH}}$`)).required(),
    confirmPin: Joi.string().required().valid(Joi.ref('pin')).messages({
        'any.only': 'confirmPin must match pin',
    }),
})
    .custom((value, helpers) => {
        value.firstName = value.firstName || value.ownerFirstName;
        value.lastName = value.lastName || value.ownerLastName;
        value.gender = value.gender || value.ownerGender;
        value.dateOfBirth = value.dateOfBirth || value.ownerDateOfBirth;
        value.shopOwner = value.shopOwner || value.ownerName;
        value.shopCategory = value.shopCategory || value.businessCategory || value.category;
        value.upiId = value.upiId || value.upiAddress;
        value.address = value.address || value.shopLocation;
        value.facilities = value.facilities ?? value.amenities ?? [];
        value.availableDays = value.availableDays ?? value.workingDays;
        value.breakTimes = value.breakTimes ?? value.breakTimings ?? [];

        if (value.workingHours) {
            if (typeof value.workingHours === 'string') {
                try {
                    value.workingHours = JSON.parse(value.workingHours);
                } catch {
                    return helpers.error('any.custom', {
                        message: 'workingHours must be a valid JSON object',
                    });
                }
            }
            value.openTime = value.openTime
                || value.opensAt
                || value.workingHours.openTime
                || value.workingHours.opensAt;
            value.closeTime = value.closeTime
                || value.closesAt
                || value.workingHours.closeTime
                || value.workingHours.closesAt;
        } else {
            value.openTime = value.openTime || value.opensAt;
            value.closeTime = value.closeTime || value.closesAt;
        }

        if (!value.shopCategory) {
            return helpers.error('any.custom', {
                message: 'shopCategory/businessCategory is required',
            });
        }
        if (!value.firstName || !value.lastName) {
            return helpers.error('any.custom', {
                message: 'firstName and lastName are required',
            });
        }
        if (!value.gender || !value.dateOfBirth) {
            return helpers.error('any.custom', {
                message: 'gender and dateOfBirth are required',
            });
        }
        if (!value.email) {
            return helpers.error('any.custom', {
                message: 'email is required',
            });
        }
        if (!value.upiId) {
            return helpers.error('any.custom', {
                message: 'upiId or upiAddress is required',
            });
        }
        if (!value.address) {
            return helpers.error('any.custom', {
                message: 'address or shopLocation is required',
            });
        }
        if (!value.availableDays) {
            return helpers.error('any.custom', {
                message: 'availableDays or workingDays is required',
            });
        }
        if (!value.openTime || !value.closeTime) {
            return helpers.error('any.custom', {
                message: 'openTime and closeTime are required',
            });
        }

        return value;
    })
    .messages({
        'any.custom': '{{#message}}',
    });
