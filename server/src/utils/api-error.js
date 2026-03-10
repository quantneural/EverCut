/**
 * Custom application error hierarchy.
 *
 * Every error carries:
 *   - statusCode  (HTTP status to return)
 *   - isOperational (true = expected error; false = programmer bug)
 *   - errors[]    (optional field-level details for validation)
 *
 * Controllers / middleware can simply `throw new NotFoundError(…)` and the
 * global error handler will format the response automatically.
 */

export class AppError extends Error {
    /**
     * @param {string}  message
     * @param {number}  statusCode
     * @param {Array}   errors       – optional field-level details
     * @param {boolean} isOperational
     */
    constructor(message, statusCode = 500, errors = [], isOperational = true) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.errors = errors;
        this.isOperational = isOperational;

        // Capture a clean stack trace (excludes this constructor frame)
        Error.captureStackTrace(this, this.constructor);
    }
}

// ---------------------------------------------------------------------------
// 400 – Bad Request (validation failures, malformed input)
// ---------------------------------------------------------------------------

export class BadRequestError extends AppError {
    constructor(message = 'Bad request', errors = []) {
        super(message, 400, errors);
    }
}

// ---------------------------------------------------------------------------
// 401 – Unauthorized (missing or invalid auth token)
// ---------------------------------------------------------------------------

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

// ---------------------------------------------------------------------------
// 403 – Forbidden (valid token but insufficient permissions)
// ---------------------------------------------------------------------------

export class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}

// ---------------------------------------------------------------------------
// 404 – Not Found
// ---------------------------------------------------------------------------

export class NotFoundError extends AppError {
    constructor(resource = 'Resource') {
        super(`${resource} not found`, 404);
    }
}

// ---------------------------------------------------------------------------
// 409 – Conflict (duplicate key, unique constraint violation)
// ---------------------------------------------------------------------------

export class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
    }
}

// ---------------------------------------------------------------------------
// 502 – Bad Gateway / Upstream dependency failure
// ---------------------------------------------------------------------------

export class ExternalServiceError extends AppError {
    constructor(message = 'External service failure') {
        super(message, 502);
    }
}

// ---------------------------------------------------------------------------
// 429 – Too Many Requests
// ---------------------------------------------------------------------------

export class TooManyRequestsError extends AppError {
    constructor(message = 'Too many requests, please try again later') {
        super(message, 429);
    }
}
