import Service from '../models/service.model.js';
import { escapeRegex } from '../utils/regex.utils.js';

class ServiceRepository {
    async create(data) {
        return Service.create(data);
    }

    async findById(id) {
        return Service.findById(id);
    }

    async findByIds(ids, selectFields, options = {}) {
        const query = Service.find({ _id: { $in: ids }, isActive: true }).session(options.session || null);
        if (selectFields) query.select(selectFields);
        return query.lean();
    }

    async findByShopId(shopId, filters = {}) {
        const query = { shopId, isActive: true, ...filters };
        return Service.find(query);
    }

    async findByShopIdAndType(shopId, serviceType, selectFields) {
        const query = Service.find({ shopId, serviceType, isActive: true });
        if (selectFields) query.select(selectFields);
        return query.sort({ createdAt: -1 }).lean();
    }

    async findByShopIdAndName(shopId, serviceName) {
        return Service.findOne({
            shopId,
            serviceName: { $regex: new RegExp(`^${escapeRegex(serviceName)}$`, 'i') },
            isActive: true,
        });
    }

    async findByShopIds(shopIds, filters = {}, selectFields) {
        const query = Service.find({ shopId: { $in: shopIds }, isActive: true, ...filters });
        if (selectFields) query.select(selectFields);
        return query.lean();
    }

    async searchByName(nameQuery, filters = {}, selectFields) {
        const query = Service.find({
            serviceName: { $regex: new RegExp(escapeRegex(nameQuery), 'i') },
            isActive: true,
            ...filters,
        });
        if (selectFields) query.select(selectFields);
        return query.populate('shopId', 'shopName address location phoneNumber category coverUrl').lean();
    }

    async updateById(id, shopId, data) {
        return Service.findOneAndUpdate(
            { _id: id, shopId },
            { $set: data },
            { new: true, runValidators: true },
        );
    }

    async softDelete(id, shopId) {
        return Service.findOneAndUpdate(
            { _id: id, shopId },
            { deletedAt: new Date(), isActive: false },
            { new: true },
        );
    }
}

export default new ServiceRepository();
