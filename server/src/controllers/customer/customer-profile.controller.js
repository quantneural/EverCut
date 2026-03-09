import * as userService from '../../services/user.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const getProfile = async (req, res, next) => {
    try {
        const profile = await userService.getProfile(req.user._id);
        return res.status(200).json(ApiResponse.success(profile, 'Profile fetched'));
    } catch (err) {
        next(err);
    }
};

export const getHomeProfile = async (req, res, next) => {
    try {
        const profile = await userService.getHomeProfile(req.user._id);
        return res.status(200).json(ApiResponse.success(profile, 'Home profile fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateProfile = async (req, res, next) => {
    try {
        const updated = await userService.updateProfile(req.user._id, req.body, req.file);
        return res.status(200).json(ApiResponse.success(updated, 'Profile updated'));
    } catch (err) {
        next(err);
    }
};
