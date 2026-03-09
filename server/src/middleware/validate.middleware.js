import { BadRequestError } from '../utils/api-error.js';

/**
 * Generic validation middleware factory.
 *
 * Pass a Joi schema (or any object with a `.validate()` method) and the
 * source to validate ('body', 'query', or 'params').
 *
 * Usage:
 *   router.post('/booking', validate(bookingSchema, 'body'), controller);
 */
export const validate = (schema, source = 'body') => {
    return (req, _res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            allowUnknown: false,
            stripUnknown: true,
        });

        if (error) {
            const errors = error.details.map((d) => d.message);
            return next(new BadRequestError('Validation failed', errors));
        }

        // Replace source with the sanitised/stripped value
        req[source] = value;
        next();
    };
};
