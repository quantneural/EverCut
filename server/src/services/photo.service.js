import mongoose from 'mongoose';
import cloudinary from '../config/cloudinary.config.js';
import photoRepository from '../repositories/photo.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import {
    BadRequestError,
    ExternalServiceError,
    NotFoundError,
} from '../utils/api-error.js';
import { MAX_PHOTOS_PER_SHOP } from '../utils/constants.js';
import { cleanupUploadedCloudinaryFiles } from '../utils/cloudinary-cleanup.utils.js';
import logger from '../utils/logger.js';

const runInTransaction = async (executor) => {
    const session = await mongoose.startSession();

    try {
        let result;
        await session.withTransaction(async () => {
            result = await executor(session);
        });
        return result;
    } finally {
        await session.endSession();
    }
};

const getOwnedShop = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');
    return shop;
};

const syncGalleryCountIfMissing = async (shop) => {
    if (typeof shop.galleryPhotoCount === 'number') return shop.galleryPhotoCount;

    const actualCount = await photoRepository.getActiveCountByShop(shop._id);
    await shopRepository.updateById(shop._id, { galleryPhotoCount: actualCount });
    return actualCount;
};

export const uploadPhotos = async (ownerId, files, photoType = 'other', description = '') => {
    let shop;
    try {
        shop = await getOwnedShop(ownerId);
    } catch (error) {
        await cleanupUploadedCloudinaryFiles(files, {
            ownerId,
            reason: 'photo_upload_shop_missing',
        });
        throw error;
    }

    if (!files || files.length === 0) {
        throw new BadRequestError('No files uploaded');
    }

    try {
        const currentCount = await syncGalleryCountIfMissing(shop);
        if (currentCount + files.length > MAX_PHOTOS_PER_SHOP) {
            throw new BadRequestError(`Photo limit exceeded. Maximum ${MAX_PHOTOS_PER_SHOP} photos allowed.`);
        }

        const photoDocs = files.map((file) => ({
            shopId: shop._id,
            photoUrl: file.path,
            cloudinaryId: file.public_id || file.filename,
            photoName: file.originalname,
            photoType,
            description,
            fileSize: file.size,
            mimeType: file.mimetype,
        }));

        return runInTransaction(async (session) => {
            const reserved = await shopRepository.incrementGalleryPhotoCount(
                shop._id,
                files.length,
                { session },
            );

            if (!reserved) {
                throw new BadRequestError(`Photo limit exceeded. Maximum ${MAX_PHOTOS_PER_SHOP} photos allowed.`);
            }

            return photoRepository.createMany(photoDocs, { session });
        });
    } catch (error) {
        await cleanupUploadedCloudinaryFiles(files, {
            ownerId,
            shopId: shop._id,
            reason: 'photo_upload_failed',
        });
        throw error;
    }
};

export const getPhotos = async (ownerId, queryFilters = {}) => {
    const shop = await getOwnedShop(ownerId);

    const filter = {};
    if (queryFilters.photoType && queryFilters.photoType !== 'all') {
        filter.photoType = queryFilters.photoType;
    }

    return photoRepository.findByShopId(shop._id, filter);
};

export const getPhotoById = async (ownerId, photoId) => {
    const shop = await getOwnedShop(ownerId);

    const photo = await photoRepository.findByIdAndShop(photoId, shop._id);
    if (!photo) throw new NotFoundError('Photo');
    return photo;
};

export const deletePhoto = async (ownerId, photoId) => {
    const shop = await getOwnedShop(ownerId);
    const photo = await photoRepository.findByIdAndShop(photoId, shop._id);
    if (!photo) throw new NotFoundError('Photo');

    const currentCount = typeof shop.galleryPhotoCount === 'number'
        ? shop.galleryPhotoCount
        : await photoRepository.getActiveCountByShop(shop._id);

    if (typeof shop.galleryPhotoCount !== 'number') {
        await shopRepository.updateById(shop._id, { galleryPhotoCount: currentCount });
    }

    if (photo.cloudinaryId) {
        try {
            const result = await cloudinary.uploader.destroy(photo.cloudinaryId);
            if (result?.result !== 'ok' && result?.result !== 'not found') {
                throw new Error(`Unexpected Cloudinary response: ${result?.result || 'unknown'}`);
            }
        } catch (error) {
            logger.error('Cloudinary photo deletion failed', {
                ownerId,
                shopId: shop._id,
                photoId,
                cloudinaryId: photo.cloudinaryId,
                error: error.message,
            });
            throw new ExternalServiceError('Unable to delete photo from storage. Please retry.');
        }
    }

    try {
        await runInTransaction(async (session) => {
            const deleted = await photoRepository.softDeleteByIdAndShop(photoId, shop._id, { session });
            if (!deleted) throw new NotFoundError('Photo');

            const decremented = await shopRepository.incrementGalleryPhotoCount(shop._id, -1, { session });
            if (!decremented) {
                await shopRepository.updateById(
                    shop._id,
                    { galleryPhotoCount: Math.max(0, currentCount - 1) },
                    { session },
                );
            }
        });
    } catch (error) {
        logger.error('Photo metadata delete failed after storage delete', {
            ownerId,
            shopId: shop._id,
            photoId,
            cloudinaryId: photo.cloudinaryId,
            error: error.message,
        });
        throw error;
    }

    return { message: 'Photo deleted successfully' };
};

export const getPhotoStats = async (ownerId) => {
    const shop = await getOwnedShop(ownerId);
    return photoRepository.getStatsByShop(shop._id);
};

export const updateShopCover = async (ownerId, file) => {
    if (!file) throw new BadRequestError('No cover image uploaded');

    let shop;
    try {
        shop = await getOwnedShop(ownerId);
    } catch (error) {
        await cleanupUploadedCloudinaryFiles(file, {
            ownerId,
            reason: 'cover_update_shop_missing',
        });
        throw error;
    }

    const coverUrl = file.path;
    const coverCloudinaryId = file.public_id || file.filename;

    try {
        const updated = await shopRepository.updateByOwnerId(ownerId, { coverUrl, coverCloudinaryId });

        if (shop.coverCloudinaryId && shop.coverCloudinaryId !== coverCloudinaryId) {
            try {
                await cloudinary.uploader.destroy(shop.coverCloudinaryId);
            } catch (error) {
                logger.warn('Old cover image cleanup failed', {
                    ownerId,
                    shopId: shop._id,
                    cloudinaryId: shop.coverCloudinaryId,
                    error: error.message,
                });
            }
        }

        return { coverUrl: updated.coverUrl, cloudinaryId: updated.coverCloudinaryId };
    } catch (error) {
        await cleanupUploadedCloudinaryFiles(file, {
            ownerId,
            shopId: shop._id,
            reason: 'cover_update_failed',
        });
        throw error;
    }
};
