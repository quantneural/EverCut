import photoRepository from '../repositories/photo.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import cloudinary from '../config/cloudinary.config.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import { MAX_PHOTOS_PER_SHOP } from '../utils/constants.js';

/**
 * Photo upload/management service for barbers.
 */

export const uploadPhotos = async (ownerId, files, photoType = 'other', description = '') => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    if (!files || files.length === 0) throw new BadRequestError('No files uploaded');

    const currentCount = await photoRepository.getActiveCountByShop(shop._id);
    if (currentCount + files.length > MAX_PHOTOS_PER_SHOP) {
        throw new BadRequestError(`Photo limit exceeded. Maximum ${MAX_PHOTOS_PER_SHOP} photos allowed.`);
    }

    const uploaded = [];
    for (const file of files) {
        const photo = await photoRepository.create({
            shopId: shop._id,
            photoUrl: file.path,
            cloudinaryId: file.public_id || file.filename,
            photoName: file.originalname,
            photoType,
            description,
            fileSize: file.size,
            mimeType: file.mimetype,
        });
        uploaded.push(photo);
    }

    return uploaded;
};

export const getPhotos = async (ownerId, queryFilters = {}) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const filter = {};
    if (queryFilters.photoType && queryFilters.photoType !== 'all') {
        filter.photoType = queryFilters.photoType;
    }

    return photoRepository.findByShopId(shop._id, filter);
};

export const getPhotoById = async (ownerId, photoId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const photo = await photoRepository.findByIdAndShop(photoId, shop._id);
    if (!photo) throw new NotFoundError('Photo');
    return photo;
};

export const deletePhoto = async (ownerId, photoId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const photo = await photoRepository.deleteByIdAndShop(photoId, shop._id);
    if (!photo) throw new NotFoundError('Photo');

    if (photo.cloudinaryId) {
        try { await cloudinary.uploader.destroy(photo.cloudinaryId); } catch { /* non-fatal */ }
    }

    return { message: 'Photo deleted successfully' };
};

export const getPhotoStats = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');
    return photoRepository.getStatsByShop(shop._id);
};

export const updateShopCover = async (ownerId, file) => {
    if (!file) throw new BadRequestError('No cover image uploaded');

    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const coverUrl = file.path;
    const coverCloudinaryId = file.public_id || file.filename;

    // Delete old cover images
    if (shop.coverCloudinaryId && shop.coverCloudinaryId !== coverCloudinaryId) {
        try { await cloudinary.uploader.destroy(shop.coverCloudinaryId); } catch { /* non-fatal */ }
    }

    const updated = await shopRepository.updateByOwnerId(ownerId, { coverUrl, coverCloudinaryId });
    return { coverUrl: updated.coverUrl, cloudinaryId: updated.coverCloudinaryId };
};
