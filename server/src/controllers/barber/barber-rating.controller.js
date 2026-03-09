import * as ratingService from '../../services/rating.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const getRatings = async (req, res, next) => {
    try {
        const ratings = await ratingService.getRatingsByShopForBarber(req.user._id);
        return res.status(200).json(ApiResponse.success(ratings, 'Ratings fetched'));
    } catch (err) {
        next(err);
    }
};

export const addReply = async (req, res, next) => {
    try {
        const { replyText } = req.body;
        const result = await ratingService.addReplyToRating(req.params.id, replyText, req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Reply added successfully'));
    } catch (err) {
        next(err);
    }
};

export const updateReply = async (req, res, next) => {
    try {
        const { replyText } = req.body;
        const result = await ratingService.updateReplyToRating(req.params.id, replyText, req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Reply updated successfully'));
    } catch (err) {
        next(err);
    }
};

export const deleteReply = async (req, res, next) => {
    try {
        const result = await ratingService.deleteReplyFromRating(req.params.id, req.user._id);
        return res.status(200).json(ApiResponse.success(result, 'Reply deleted successfully'));
    } catch (err) {
        next(err);
    }
};
