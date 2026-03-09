import * as ratingService from '../../services/rating.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const addRating = async (req, res, next) => {
    try {
        const { shopId, rating, review } = req.body;
        const result = await ratingService.addRating(req.user._id, shopId, rating, review);
        return res.status(201).json(ApiResponse.success(result, 'Rating submitted'));
    } catch (err) {
        next(err);
    }
};

export const getRatingsByShop = async (req, res, next) => {
    try {
        const ratings = await ratingService.getRatingsByShop(req.params.id);
        return res.status(200).json(ApiResponse.success(ratings, 'Ratings fetched'));
    } catch (err) {
        next(err);
    }
};

export const getRatingSummary = async (req, res, next) => {
    try {
        const summary = await ratingService.getRatingSummary(req.params.id);
        return res.status(200).json(ApiResponse.success(summary, 'Rating summary'));
    } catch (err) {
        next(err);
    }
};
