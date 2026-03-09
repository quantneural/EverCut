/**
 * Structured logger with sensitive data redaction.
 *
 * Features:
 *   - JSON-formatted log entries with level, timestamp, message, and metadata
 *   - Automatic redaction of sensitive patterns (URIs, tokens, keys, passwords)
 *   - Configurable log levels via LOG_LEVEL env var
 *
 * Keeping it dependency-free for now; swap with winston/pino later if needed.
 */

const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const CURRENT_LEVEL =
    LOG_LEVELS[process.env.LOG_LEVEL?.toLowerCase()] ?? LOG_LEVELS.debug;

// ---------------------------------------------------------------------------
// Sensitive data redaction
// ---------------------------------------------------------------------------

/**
 * Patterns that indicate sensitive data which must NEVER appear in logs.
 * Each pattern replaces the matched content with a redacted placeholder.
 */
const SENSITIVE_PATTERNS = [
    // MongoDB connection URIs (mongodb:// or mongodb+srv://)
    { regex: /mongodb(\+srv)?:\/\/[^\s,'"}\]]+/gi, replacement: 'mongodb://***REDACTED***' },
    // Generic connection strings with credentials (user:pass@host)
    { regex: /\/\/[^:]+:[^@]+@[^\s,'"}\]]+/gi, replacement: '//***REDACTED***' },
    // Bearer tokens
    { regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer ***REDACTED***' },
    // Firebase private keys
    { regex: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi, replacement: '***PRIVATE_KEY_REDACTED***' },
    // API keys/secrets that look like long hex or base64 strings (32+ chars)
    { regex: /(?:api[_-]?key|api[_-]?secret|password|passwd|secret|token|authorization)\s*[:=]\s*['"]?([A-Za-z0-9+/=_\-]{20,})['"]?/gi, replacement: '$1: ***REDACTED***' },
];

/**
 * Redact sensitive information from a string.
 *
 * @param   {string} text
 * @returns {string}
 */
const redact = (text) => {
    if (typeof text !== 'string') return text;
    let result = text;
    for (const { regex, replacement } of SENSITIVE_PATTERNS) {
        result = result.replace(regex, replacement);
    }
    return result;
};

const deepRedact = (value) => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'string') return redact(value);
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Error) return { message: value.message, stack: value.stack };

    // Convert Mongoose ObjectIds or other objects that implement standard toString 
    // but aren't pure generic Objects/Arrays
    if (typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
        return value.toString();
    }

    if (Array.isArray(value)) return value.map(deepRedact);
    if (typeof value === 'object') {
        const cleaned = {};
        for (const [k, v] of Object.entries(value)) {
            // Completely mask known-sensitive field names
            const lowerKey = k.toLowerCase();
            if (
                lowerKey.includes('password') ||
                lowerKey.includes('secret') ||
                lowerKey.includes('pinhash') ||
                lowerKey.includes('private_key') ||
                lowerKey.includes('privatekey') ||
                lowerKey === 'authorization'
            ) {
                cleaned[k] = '***REDACTED***';
            } else {
                cleaned[k] = deepRedact(v);
            }
        }
        return cleaned;
    }
    return value;
};

// ---------------------------------------------------------------------------
// Formatter
// ---------------------------------------------------------------------------

/**
 * Format a log entry as a JSON string with redaction applied.
 */
const formatEntry = (level, message, meta = {}) => {
    const entry = {
        level,
        timestamp: new Date().toISOString(),
        message: redact(message),
        ...deepRedact(meta),
    };
    return JSON.stringify(entry);
};

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const logger = {
    debug(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.debug) {
            console.debug(formatEntry('debug', message, meta));
        }
    },

    info(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.info) {
            console.info(formatEntry('info', message, meta));
        }
    },

    warn(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.warn) {
            console.warn(formatEntry('warn', message, meta));
        }
    },

    error(message, meta) {
        if (CURRENT_LEVEL <= LOG_LEVELS.error) {
            console.error(formatEntry('error', message, meta));
        }
    },
};

export default logger;
