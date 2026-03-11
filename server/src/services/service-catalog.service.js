import serviceRepository from '../repositories/service.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import cloudinary from '../config/cloudinary.config.js';
import { NotFoundError, ConflictError } from '../utils/api-error.js';
import { escapeRegex } from '../utils/regex.utils.js';

/**
 * Service-catalog service — manages the salon services (haircut, etc.)
 */

export const addService = async (ownerId, data) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    // Check for duplicate
    const existing = await serviceRepository.findByShopIdAndName(shop._id, data.serviceName);
    if (existing) throw new ConflictError('Service already exists');

    // Resolve image from Cloudinary
    const formattedName = data.serviceName.toLowerCase().replace(/\s+/g, '');
    const folderPath = data.serviceType === 'bundled' ? 'evercut/bundled' : 'evercut/single';
    const publicId = `${folderPath}/${formattedName}`;

    let imageUrl;
    try {
        const resource = await cloudinary.api.resource(publicId);
        imageUrl = resource.secure_url;
    } catch {
        imageUrl = cloudinary.url('evercut/default/service.jpg', { secure: true, resource_type: 'image' });
    }

    const serviceData = {
        shopId: shop._id,
        serviceName: data.serviceName,
        serviceType: data.serviceType,
        serviceFor: data.serviceFor || 'unisex',
        imageUrl,
        actualPrice: data.actualPrice,
        offerPrice: data.offerPrice || 0,
    };

    if (data.serviceType === 'single') {
        serviceData.duration = data.duration;
        serviceData.finalPrice = Number(data.actualPrice) - Number(data.offerPrice || 0);
    } else {
        serviceData.bundledServices = data.bundledServices || [];
        serviceData.totalDuration = data.totalDuration;
        serviceData.totalPrice = Number(data.actualPrice) - Number(data.offerPrice || 0);
    }

    return serviceRepository.create(serviceData);
};

export const getServices = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');
    return serviceRepository.findByShopId(shop._id);
};

export const updateService = async (ownerId, serviceId, data) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const updated = await serviceRepository.updateById(serviceId, shop._id, data);
    if (!updated) throw new NotFoundError('Service');
    return updated;
};

export const deleteService = async (ownerId, serviceId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const deleted = await serviceRepository.softDelete(serviceId, shop._id);
    if (!deleted) throw new NotFoundError('Service');
    return { message: 'Service deleted successfully' };
};

export const searchServices = async (query, gender) => {
    const filters = {};
    if (gender) filters.serviceFor = { $regex: new RegExp(`^${escapeRegex(gender)}$`, 'i') };
    return serviceRepository.searchByName(query, filters, 'serviceName serviceFor shopId');
};

export const searchShops = async (query) => {
    return shopRepository.searchByName(query, 'shopName address location phoneNumber category coverUrl');
};

export const getServicesByGender = async (gender) => {
    return serviceRepository.findByGender(gender, 'serviceName shopId serviceFor serviceType');
};
