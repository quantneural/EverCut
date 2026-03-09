import Joi from 'joi';
import { ALL_SHOP_CATEGORIES, DAYS_OF_WEEK, ALL_SERVICE_FOR } from '../utils/constants.js';
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
    isOpen: Joi.any().strip(),
}).rename('isOpen', 'status', { ignoreUndefined: true, override: false });

export const updatePinSchema = Joi.object({
    currentPin: Joi.string().required(),
    newPin: Joi.string().pattern(/^\d{4,6}$/).required(),
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
