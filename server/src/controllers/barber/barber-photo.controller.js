import * as photoService from '../../services/photo.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const uploadPhotos = async (req, res, next) => {
    try {
        const { photoType, description } = req.body;
        const photos = await photoService.uploadPhotos(req.user._id, req.files, photoType, description);
        return res.status(201).json(ApiResponse.success(photos, `${photos.length} photo(s) uploaded`, 201));
    } catch (err) {
        next(err);
    }
};

export const getPhotos = async (req, res, next) => {
    try {
        const photos = await photoService.getPhotos(req.user._id, req.query);
        return res.status(200).json(ApiResponse.success(photos, 'Photos fetched'));
    } catch (err) {
        next(err);
    }
};

export const getPhotoById = async (req, res, next) => {
    try {
        const photo = await photoService.getPhotoById(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(photo, 'Photo fetched'));
    } catch (err) {
        next(err);
    }
};

export const deletePhoto = async (req, res, next) => {
    try {
        const result = await photoService.deletePhoto(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Photo deleted'));
    } catch (err) {
        next(err);
    }
};

export const getPhotoStats = async (req, res, next) => {
    try {
        const stats = await photoService.getPhotoStats(req.user._id);
        return res.status(200).json(ApiResponse.success(stats, 'Photo stats'));
    } catch (err) {
        next(err);
    }
};
