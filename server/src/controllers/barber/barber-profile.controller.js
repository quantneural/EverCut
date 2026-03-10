import * as shopService from '../../services/shop.service.js';
import * as pinService from '../../services/pin.service.js';
import * as photoService from '../../services/photo.service.js';
import * as accountService from '../../services/account.service.js';
import shopRepository from '../../repositories/shop.repository.js';
import { ApiResponse } from '../../utils/api-response.js';
import { BadRequestError, NotFoundError } from '../../utils/api-error.js';

export const getProfile = async (req, res, next) => {
    try {
        const shop = await shopService.getShopByOwner(req.user._id);
        return res.status(200).json(ApiResponse.success(shop, 'Barber profile fetched'));
    } catch (err) {
        next(err);
    }
};

export const updatePin = async (req, res, next) => {
    try {
        const { currentPin, newPin, confirmNewPin } = req.body;

        const validation = pinService.validatePinUpdate({ currentPin, newPin, confirmNewPin });
        if (!validation.isValid) throw new BadRequestError(validation.message);

        const shop = await shopRepository.findByOwnerId(req.user._id);
        if (!shop) throw new NotFoundError('Shop profile');

        const isValid = await pinService.verifyPin(shop.pinHash, currentPin);
        if (!isValid) throw new BadRequestError('Current PIN is incorrect');

        const newHash = await pinService.hashPin(newPin);
        await shopRepository.updateByOwnerId(req.user._id, { pinHash: newHash });

        return res.status(200).json(ApiResponse.success(null, 'PIN updated successfully'));
    } catch (err) {
        next(err);
    }
};

export const updateCover = async (req, res, next) => {
    try {
        const result = await photoService.updateShopCover(req.user._id, req.file);
        return res.status(200).json(ApiResponse.success(result, 'Cover image updated'));
    } catch (err) {
        next(err);
    }
};

export const updatePicture = async (req, res, next) => {
    try {
        const result = await accountService.updateBarberProfilePicture(req.user._id, req.file);
        return res.status(200).json(ApiResponse.success(result, 'Profile picture updated'));
    } catch (err) {
        next(err);
    }
};

export const signOutEverywhere = async (req, res, next) => {
    try {
        const result = await accountService.signOutEverywhere(req.user.firebaseUid);
        return res.status(200).json(ApiResponse.success(result, 'Signed out from all devices'));
    } catch (err) {
        next(err);
    }
};

export const deleteAccount = async (req, res, next) => {
    try {
        const result = await accountService.deleteBarberAccount(req.user, req.body.currentPin);
        return res.status(200).json(ApiResponse.success(result, 'Account deleted successfully'));
    } catch (err) {
        next(err);
    }
};
