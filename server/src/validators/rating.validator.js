import Joi from 'joi';

export const addRatingSchema = Joi.object({
    shopId: Joi.string().required().messages({
        'string.empty': 'Shop ID is required',
        'any.required': 'Shop ID is required',
    }),
    rating: Joi.number().integer().min(1).max(5).required().messages({
        'number.base': 'Rating must be a number',
        'number.min': 'Rating must be between 1 and 5',
        'number.max': 'Rating must be between 1 and 5',
        'any.required': 'Rating is required',
    }),
    review: Joi.string().max(500).allow('').optional().messages({
        'string.max': 'Review cannot exceed 500 characters',
    }),
});

export const addReplySchema = Joi.object({
    replyText: Joi.string().required().max(500).messages({
        'string.empty': 'Reply text is required',
        'any.required': 'Reply text is required',
        'string.max': 'Reply text cannot exceed 500 characters',
    }),
});
