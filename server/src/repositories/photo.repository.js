import Photo from '../models/photo.model.js';

class PhotoRepository {
    async create(data) {
        return Photo.create(data);
    }

    async findByShopId(shopId, query = {}) {
        const filter = { shopId, isActive: true, ...query };
        return Photo.find(filter).sort({ createdAt: -1 });
    }

    async findByIdAndShop(id, shopId) {
        return Photo.findOne({ _id: id, shopId, isActive: true });
    }

    async deleteByIdAndShop(id, shopId) {
        return Photo.findOneAndDelete({ _id: id, shopId, isActive: true });
    }

    async getActiveCountByShop(shopId) {
        return Photo.countDocuments({ shopId, isActive: true });
    }

    async getStatsByShop(shopId) {
        const [byType, totalSize] = await Promise.all([
            Photo.aggregate([
                { $match: { shopId, isActive: true } },
                { $group: { _id: '$photoType', count: { $sum: 1 }, totalSize: { $sum: '$fileSize' } } },
            ]),
            Photo.aggregate([
                { $match: { shopId, isActive: true } },
                { $group: { _id: null, totalSize: { $sum: '$fileSize' } } },
            ]),
        ]);

        const totalPhotos = await this.getActiveCountByShop(shopId);

        return {
            totalPhotos,
            totalSize: totalSize[0]?.totalSize || 0,
            byType,
        };
    }
}

export default new PhotoRepository();
