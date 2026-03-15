import Joi from 'joi';
import {
    ALL_GENDERS,
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    ALL_SHOP_CATEGORIES,
    DAYS_OF_WEEK,
    SECURITY_PIN_LENGTH,
} from '../utils/constants.js';
import { objectId } from './common.validator.js';

const coordinatesPattern = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const normalizeCoordinates = (value, helpers) => {
    let { longitude, latitude } = value;

    if ((longitude === undefined || latitude === undefined) && value.coordinates) {
        const match = value.coordinates.match(coordinatesPattern);
        if (!match) {
            return helpers.error('any.custom', {
                message: 'coordinates must be in "longitude,latitude" format',
            });
        }

        longitude = Number(match[1]);
        latitude = Number(match[2]);
    }

    if (longitude === undefined || latitude === undefined) {
        return helpers.error('any.custom', {
            message: 'longitude and latitude are required',
        });
    }

    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return helpers.error('any.custom', {
            message: 'longitude/latitude values are out of range',
        });
    }

    value.longitude = longitude;
    value.latitude = latitude;
    return value;
};

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

export const updateBusinessSchema = Joi.object({
    shopName: Joi.string().trim().min(1).max(100),
    ownerName: Joi.string().trim().min(1).max(100),
    shopOwner: Joi.string().trim().min(1).max(100),
    ownerFirstName: Joi.string().trim().min(1).max(50),
    ownerLastName: Joi.string().trim().min(1).max(50),
    ownerGender: Joi.string().valid(...ALL_GENDERS),
    ownerDateOfBirth: Joi.date(),
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    gender: Joi.string().valid(...ALL_GENDERS),
    dateOfBirth: Joi.date(),
    numberOfEmployees: Joi.number().integer().min(1),
    yearsOfExperience: Joi.number().integer().min(0),
    upiId: Joi.string(),
    upiAddress: Joi.string(),
    accountHolderName: Joi.string().trim().min(1).max(100),
    bankName: Joi.string().trim().min(1).max(120),
    bio: Joi.string().max(500).allow(''),
    address: Joi.string().trim(),
    shopLocation: Joi.string().trim(),
    targetCustomers: targetCustomersSchema,
    category: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    shopCategory: Joi.string().valid(...ALL_SHOP_CATEGORIES),
    businessCategory: Joi.string().valid(...ALL_SHOP_CATEGORIES),
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
    location: Joi.alternatives().try(
        Joi.object({
            type: Joi.string().valid('Point').required(),
            coordinates: Joi.array().items(Joi.number()).length(2).required(),
        }),
        Joi.string(),
    ),
})
    .custom((value) => {
        value.ownerName = value.ownerName || value.shopOwner;
        value.ownerFirstName = value.ownerFirstName || value.firstName;
        value.ownerLastName = value.ownerLastName || value.lastName;
        value.ownerGender = value.ownerGender || value.gender;
        value.ownerDateOfBirth = value.ownerDateOfBirth || value.dateOfBirth;
        value.upiId = value.upiId || value.upiAddress;
        value.address = value.address || value.shopLocation;
        value.category = value.category || value.shopCategory || value.businessCategory;
        value.facilities = value.facilities ?? value.amenities;
        value.availableDays = value.availableDays ?? value.workingDays;
        value.breakTimes = value.breakTimes ?? value.breakTimings;

        if (value.workingHours) {
            if (typeof value.workingHours === 'string') {
                try {
                    value.workingHours = JSON.parse(value.workingHours);
                } catch {
                    // Keep original value; service will return a clear validation error.
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

        return value;
    })
    .min(1);

export const updateUpiDetailsSchema = Joi.object({
    upiId: Joi.string().trim(),
    upiAddress: Joi.string().trim(),
    accountHolderName: Joi.string().trim().min(1).max(100),
    bankName: Joi.string().trim().min(1).max(120),
    isVerified: Joi.any().strip(),
    verificationStatus: Joi.any().strip(),
})
    .custom((value) => {
        value.upiId = value.upiId || value.upiAddress;
        return value;
    })
    .min(1);

export const toggleStatusSchema = Joi.object({
    status: Joi.alternatives().try(Joi.boolean(), Joi.string()).optional(),
    isOpen: Joi.any().strip(),
}).rename('isOpen', 'status', { ignoreUndefined: true, override: false });

export const updatePinSchema = Joi.object({
    currentPin: Joi.string().required(),
    newPin: Joi.string().pattern(new RegExp(`^\\d{${SECURITY_PIN_LENGTH}}$`)).required(),
    confirmNewPin: Joi.string().required().valid(Joi.ref('newPin')).messages({
        'any.only': 'confirmNewPin must match newPin',
    }),
    confirmPin: Joi.any().strip(),
}).rename('confirmPin', 'confirmNewPin', { ignoreUndefined: true, override: false });

export const shopIdParamSchema = Joi.object({
    id: objectId.required(),
});

export const nearbyShopsQuerySchema = Joi.object({
    longitude: Joi.number().min(-180).max(180),
    latitude: Joi.number().min(-90).max(90),
    coordinates: Joi.string().pattern(coordinatesPattern),
})
    .custom(normalizeCoordinates, 'coordinates normalization')
    .messages({ 'any.custom': '{{#message}}' });

export const servicesByGenderQuerySchema = Joi.object({
    longitude: Joi.number().min(-180).max(180),
    latitude: Joi.number().min(-90).max(90),
    coordinates: Joi.string().pattern(coordinatesPattern),
    gender: Joi.string().valid(...ALL_SERVICE_FOR).default('unisex'),
    search: Joi.string().trim().max(100).allow(''),
})
    .custom(normalizeCoordinates, 'coordinates normalization')
    .messages({ 'any.custom': '{{#message}}' });

export const searchServicesQuerySchema = Joi.object({
    query: Joi.string().trim().min(1).max(100).required(),
    gender: Joi.string().valid(...ALL_SERVICE_FOR),
});

export const searchShopsQuerySchema = Joi.object({
    query: Joi.string().trim().min(1).max(100).required(),
});
