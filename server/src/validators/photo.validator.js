import Joi from 'joi';
import { ALL_PHOTO_TYPES } from '../utils/constants.js';

export const photoUploadSchema = Joi.object({
    photoType: Joi.string().valid(...ALL_PHOTO_TYPES).default('other'),
    description: Joi.string().max(500).allow('').default(''),
});

export const photoFilterQuerySchema = Joi.object({
    photoType: Joi.string().valid('all', ...ALL_PHOTO_TYPES).default('all'),
});
