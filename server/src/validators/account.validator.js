import Joi from 'joi';
import { SECURITY_PIN_LENGTH } from '../utils/constants.js';

export const deleteBarberAccountSchema = Joi.object({
    currentPin: Joi.string().pattern(new RegExp(`^\\d{${SECURITY_PIN_LENGTH}}$`)).required(),
});
