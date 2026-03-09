import * as earningsService from '../../services/earnings.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const getEarnings = async (req, res, next) => {
    try {
        const earnings = await earningsService.getEarnings(req.user._id);
        return res.status(200).json(ApiResponse.success(earnings, 'Earnings fetched'));
    } catch (err) {
        next(err);
    }
};
