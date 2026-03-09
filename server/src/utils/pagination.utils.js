import config from '../config/index.js';

/**
 * Build standard pagination metadata from query params.
 *
 * @param   {Object}  query          – req.query
 * @param   {number}  totalDocuments – total count from DB
 * @returns {{ skip: number, limit: number, pagination: Object }}
 */
export const buildPagination = (query, totalDocuments) => {
    const page = Math.max(1, parseInt(query.page, 10) || config.pagination.defaultPage);
    const limit = Math.min(
        Math.max(1, parseInt(query.limit, 10) || config.pagination.defaultLimit),
        config.pagination.maxLimit,
    );

    const totalPages = Math.ceil(totalDocuments / limit);
    const skip = (page - 1) * limit;

    return {
        skip,
        limit,
        pagination: {
            currentPage: page,
            totalPages,
            totalDocuments,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
};
