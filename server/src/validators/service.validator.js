import Joi from 'joi';
import { ALL_SERVICE_TYPES, ALL_SERVICE_FOR } from '../utils/constants.js';

export const addServiceSchema = Joi.object({
    serviceName: Joi.string().trim().min(1).max(100).required(),
    serviceType: Joi.string().valid(...ALL_SERVICE_TYPES).required(),
    serviceFor: Joi.string().valid(...ALL_SERVICE_FOR).default('unisex'),
    actualPrice: Joi.number().min(0).required(),
    offerPrice: Joi.number().min(0).default(0),
    duration: Joi.number().min(1).when('serviceType', { is: 'single', then: Joi.required() }),
    bundledServices: Joi.array().items(Joi.string()).when('serviceType', { is: 'bundled', then: Joi.required() }),
    totalDuration: Joi.number().min(1).when('serviceType', { is: 'bundled', then: Joi.required() }),
});

export const updateServiceSchema = Joi.object({
    serviceName: Joi.string().trim().min(1).max(100),
    serviceFor: Joi.string().valid(...ALL_SERVICE_FOR),
    actualPrice: Joi.number().min(0),
    offerPrice: Joi.number().min(0),
    duration: Joi.number().min(1),
    bundledServices: Joi.array().items(Joi.string()),
    totalDuration: Joi.number().min(1),
}).min(1);
