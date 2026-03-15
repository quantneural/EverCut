import * as shopService from '../../services/shop.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const getShopProfile = async (req, res, next) => {
    try {
        const shop = await shopService.getShopByOwner(req.user._id, req.user);
        return res.status(200).json(ApiResponse.success(shop, 'Shop profile fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateBusinessInfo = async (req, res, next) => {
    try {
        const result = await shopService.updateBusinessInfo(req.user._id, req.body, req.user);
        return res.status(200).json(ApiResponse.success(result, 'Business info updated'));
    } catch (err) {
        next(err);
    }
};

export const getUpiDetails = async (req, res, next) => {
    try {
        const details = await shopService.getUpiDetails(req.user._id);
        return res.status(200).json(ApiResponse.success(details, 'UPI details fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateUpiDetails = async (req, res, next) => {
    try {
        const details = await shopService.updateUpiDetails(req.user._id, req.body, req.user);
        return res.status(200).json(ApiResponse.success(details, 'UPI details updated'));
    } catch (err) {
        next(err);
    }
};

export const toggleShopStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const result = await shopService.toggleShopStatus(req.user._id, status);
        return res.status(200).json(ApiResponse.success(result, 'Shop status updated'));
    } catch (err) {
        next(err);
    }
};
