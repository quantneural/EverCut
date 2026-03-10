import Shop from '../models/shop.model.js';
import {
    MAX_PHOTOS_PER_SHOP,
    NEARBY_DISTANCE_METERS,
} from '../utils/constants.js';

class ShopRepository {
    async create(data) {
        return Shop.create(data);
    }

    async findById(id) {
        return Shop.findById(id);
    }

    async findByOwnerId(ownerId) {
        return Shop.findOne({ ownerId });
    }

    async updateByOwnerId(ownerId, data, options = {}) {
        return Shop.findOneAndUpdate(
            { ownerId },
            { $set: data },
            { new: true, runValidators: true, session: options.session },
        );
    }

    async updateById(id, data, options = {}) {
        return Shop.findByIdAndUpdate(
            id,
            { $set: data },
            { new: true, runValidators: true, session: options.session },
        );
    }

    async incrementGalleryPhotoCount(shopId, delta, options = {}) {
        const filter = { _id: shopId };

        if (delta >= 0) {
            filter.$or = [
                { galleryPhotoCount: { $exists: false } },
                { galleryPhotoCount: { $lte: Math.max(0, MAX_PHOTOS_PER_SHOP - delta) } },
            ];
        } else {
            filter.galleryPhotoCount = { $gte: Math.abs(delta) };
        }

        return Shop.findOneAndUpdate(
            filter,
            { $inc: { galleryPhotoCount: delta } },
            {
                new: true,
                session: options.session,
            },
        );
    }

    async findNearby(coordinates, maxDistance = NEARBY_DISTANCE_METERS, selectFields) {
        const query = Shop.find({
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates },
                    $maxDistance: maxDistance,
                },
            },
        });
        if (selectFields) query.select(selectFields);
        return query;
    }

    async findByCategory(category, selectFields) {
        const query = Shop.find({ category });
        if (selectFields) query.select(selectFields);
        return query;
    }

    async findByIdWithFields(id, fields) {
        return Shop.findById(id).select(fields).lean();
    }

    async softDelete(id) {
        return Shop.findByIdAndUpdate(id, { deletedAt: new Date() });
    }
}

export default new ShopRepository();
