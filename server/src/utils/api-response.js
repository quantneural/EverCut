/**
 * Standardised API response helpers.
 *
 * Usage in controllers:
 *   res.status(200).json(ApiResponse.success(data, 'User fetched'));
 *   res.status(400).json(ApiResponse.error('Validation failed', 400, errors));
 */

export class ApiResponse {
    /**
     * Success envelope.
     * @param {*}      data
     * @param {string} message
     * @param {number} statusCode
     */
    static success(data = null, message = 'Success', statusCode = 200) {
        return {
            success: true,
            statusCode,
            message,
            data,
        };
    }

    /**
     * Error envelope.
     * @param {string} message
     * @param {number} statusCode
     * @param {Array}  errors      – optional field-level details
     */
    static error(message = 'Error', statusCode = 500, errors = []) {
        const body = {
            success: false,
            statusCode,
            message,
        };
        if (errors.length > 0) {
            body.errors = errors;
        }
        return body;
    }

    /**
     * Paginated success envelope.
     * @param {Array}  items
     * @param {Object} pagination – { page, limit, total, totalPages }
     * @param {string} message
     */
    static paginated(items, pagination, message = 'Success') {
        return {
            success: true,
            statusCode: 200,
            message,
            data: items,
            pagination,
        };
    }
}
