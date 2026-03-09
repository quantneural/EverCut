import bcrypt from 'bcryptjs';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { SECURITY_PIN_LENGTH } from '../utils/constants.js';

/**
 * PIN service — all PIN-related operations for barbers.
 *
 * Security notes:
 *   - PINs are always stored as bcrypt hashes — NEVER in plaintext
 *   - Legacy plaintext PINs are rejected (no backward compatibility for insecure storage)
 *   - PIN format is validated before hashing
 */

const PIN_REGEX = new RegExp(`^\\d{${SECURITY_PIN_LENGTH}}$`);

export const validatePinFormat = (pin) => {
    if (!pin) return { isValid: false, message: 'PIN is required' };
    if (!PIN_REGEX.test(pin)) return { isValid: false, message: `PIN must be exactly ${SECURITY_PIN_LENGTH} digits` };
    return { isValid: true };
};

export const validatePinCreation = (pin, confirmPin) => {
    if (pin !== confirmPin) {
        return { isValid: false, message: 'PINs do not match' };
    }
    return validatePinFormat(pin);
};

export const validatePinUpdate = ({ currentPin, newPin, confirmNewPin }) => {
    if (!currentPin || !newPin || !confirmNewPin) {
        return { isValid: false, message: 'All PIN fields are required (currentPin, newPin, confirmNewPin)' };
    }
    const fmt = validatePinFormat(newPin);
    if (!fmt.isValid) return { isValid: false, message: `New PIN: ${fmt.message}` };
    if (newPin !== confirmNewPin) return { isValid: false, message: 'New PIN and confirm PIN do not match' };
    if (currentPin === newPin) return { isValid: false, message: 'New PIN must be different from current PIN' };
    return { isValid: true };
};

export const hashPin = async (pin) => {
    return bcrypt.hash(pin, config.security.bcryptSaltRounds);
};

/**
 * Verify a PIN against a stored bcrypt hash.
 *
 * Only bcrypt hashes are accepted. If a legacy plaintext PIN is detected,
 * it is rejected — the barber must reset their PIN via the update flow.
 *
 * @param   {string}  storedHash – bcrypt hash from the database
 * @param   {string}  inputPin   – plaintext PIN from the request
 * @returns {Promise<boolean>}
 */
export const verifyPin = async (storedHash, inputPin) => {
    try {
        if (!storedHash || !inputPin) return false;

        // Only accept bcrypt hashes ($2b$ or $2a$ prefix)
        if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
            return bcrypt.compare(inputPin, storedHash);
        }

        // Legacy plaintext PIN detected — reject and log a warning
        // The barber must update their PIN through the proper flow
        logger.warn('Legacy plaintext PIN detected — rejecting. Barber must reset PIN.');
        return false;
    } catch {
        return false;
    }
};
