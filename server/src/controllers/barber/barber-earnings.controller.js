import * as earningsService from '../../services/earnings.service.js';
import * as ratingService from '../../services/rating.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const getEarnings = async (req, res, next) => {
    try {
        const earnings = await earningsService.getEarnings(req.user._id);
        return res.status(200).json(ApiResponse.success(earnings, 'Earnings fetched'));
    } catch (err) {
        next(err);
    }
};

export const removeRating = async (req, res, next) => {
    try {
        const result = await ratingService.removeRating(req.params.id, req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Rating removed'));
    } catch (err) {
        next(err);
    }
};
