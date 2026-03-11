/**
 * Escapes special regex characters in a string to prevent ReDoS attacks
 * and unintended regex behavior when using user-supplied input in RegExp constructors.
 *
 * @param {string} str - The string to escape
 * @returns {string} The escaped string safe for use in RegExp
 */
export const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
