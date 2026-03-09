import shopRepository from '../repositories/shop.repository.js';
import serviceRepository from '../repositories/service.repository.js';
import photoRepository from '../repositories/photo.repository.js';
import ratingRepository from '../repositories/rating.repository.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import { NEARBY_DISTANCE_METERS, SHOP_CATEGORY, ALL_SHOP_CATEGORIES, DAYS_OF_WEEK } from '../utils/constants.js';

/**
 * Shop / Salon service — business logic for shop management and discovery.
 */

// ── Get shop profile (barber-side) ───────────────────────────────────────

export const getShopByOwner = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');
    const { pinHash, ...safe } = shop.toObject();
    return safe;
};

// ── Update business info ─────────────────────────────────────────────────

const ALLOWED_UPDATE_FIELDS = [
    'shopName', 'numberOfEmployees', 'yearsOfExperience', 'ownerName',
    'emailId', 'upiId', 'location', 'bio', 'address', 'category',
    'facilities', 'availableDays', 'openTime', 'closeTime', 'breakTimes',
];

export const updateBusinessInfo = async (ownerId, body) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const updateData = {};
    const errors = [];

    for (const [key, value] of Object.entries(body)) {
        if (!ALLOWED_UPDATE_FIELDS.includes(key)) continue;
        if (value === undefined || value === null || value === '') continue;

        switch (key) {
            case 'category':
                if (!ALL_SHOP_CATEGORIES.includes(value)) {
                    errors.push(`Invalid category. Must be one of: ${ALL_SHOP_CATEGORIES.join(', ')}`);
                    continue;
                }
                break;
            case 'numberOfEmployees': {
                const n = parseInt(value, 10);
                if (Number.isNaN(n) || n < 1) { errors.push('numberOfEmployees must be ≥ 1'); continue; }
                updateData[key] = n; continue;
            }
            case 'yearsOfExperience': {
                const y = parseInt(value, 10);
                if (Number.isNaN(y) || y < 0) { errors.push('yearsOfExperience must be ≥ 0'); continue; }
                updateData[key] = y; continue;
            }
            case 'emailId':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { errors.push('Invalid email format'); continue; }
                break;
            case 'availableDays':
                if (Array.isArray(value)) {
                    const invalid = value.filter((d) => !DAYS_OF_WEEK.includes(d));
                    if (invalid.length) { errors.push(`Invalid days: ${invalid.join(', ')}`); continue; }
                }
                break;
            case 'location':
                if (typeof value === 'string') {
                    try { updateData[key] = JSON.parse(value); continue; } catch { errors.push('Invalid location format'); continue; }
                }
                break;
        }
        updateData[key] = value;
    }

    if (errors.length) throw new BadRequestError('Validation failed', errors);
    if (Object.keys(updateData).length === 0) throw new BadRequestError('No valid fields provided for update');

    const updated = await shopRepository.updateByOwnerId(ownerId, updateData);
    const { pinHash, ...safe } = updated.toObject();
    return { shop: safe, updatedFields: Object.keys(updateData) };
};

// ── Toggle open/closed ───────────────────────────────────────────────────

export const toggleShopStatus = async (ownerId, requestedStatus) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    let isOpen;
    if (typeof requestedStatus === 'boolean') {
        isOpen = requestedStatus;
    } else if (typeof requestedStatus === 'string') {
        const s = requestedStatus.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(s)) isOpen = true;
        else if (['false', '0', 'no', 'off'].includes(s)) isOpen = false;
    }

    // If no valid boolean provided, toggle
    if (typeof isOpen !== 'boolean') isOpen = !shop.isOpen;

    shop.isOpen = isOpen;
    await shop.save();

    return { isOpen: shop.isOpen };
};

// ── Customer-facing: shop info page ──────────────────────────────────────

export const getShopInfoForCustomer = async (shopId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) throw new NotFoundError('Shop');

    const [singleServices, bundledServices, photos, ratingSummary] = await Promise.all([
        serviceRepository.findByShopIdAndType(shopId, 'single', 'serviceName duration finalPrice actualPrice offerPrice imageUrl serviceFor'),
        serviceRepository.findByShopIdAndType(shopId, 'bundled', 'serviceName bundledServices totalDuration totalPrice imageUrl serviceFor'),
        photoRepository.findByShopId(shopId, {}),
        ratingRepository.getShopSummary(shopId),
    ]);

    // Fetch individual reviews
    const ratings = await ratingRepository.findByShop(shopId);
    const formattedRatings = ratings.map((r) => ({
        ratingId: r._id,
        rating: r.rating,
        review: r.review,
        user: {
            firstName: r.customerId?.firstName || 'Unknown',
            photoUrl: r.customerId?.photoUrl || null,
        },
        createdAt: r.createdAt,
    }));

    const { pinHash, ...safeShop } = shop.toObject();
    return {
        shop: safeShop,
        services: { single: singleServices, bundled: bundledServices },
        photos,
        ratings: { ...ratingSummary, details: formattedRatings },
    };
};

// ── Nearby shops ─────────────────────────────────────────────────────────

export const getNearbyShops = async (coordinates) => {
    return shopRepository.findNearby(
        coordinates,
        NEARBY_DISTANCE_METERS,
        'shopName address coverUrl facilities',
    );
};

// ── Doorstep services ────────────────────────────────────────────────────

export const getDoorstepShops = async () => {
    return shopRepository.findByCategory(
        SHOP_CATEGORY.DOOR_STEP,
        'shopName location coverUrl address',
    );
};

// ── Services by gender (nearby) ──────────────────────────────────────────

export const getNearbyServicesByGender = async (coordinates, gender, searchTerm) => {
    const nearbyShops = await shopRepository.findNearby(
        coordinates,
        NEARBY_DISTANCE_METERS,
        'shopName address coverUrl',
    );

    if (!nearbyShops.length) return { shops: [], services: [] };

    const shopIds = nearbyShops.map((s) => s._id);
    const serviceFilter = { serviceFor: { $regex: new RegExp(`^${gender}$`, 'i') } };
    if (searchTerm) serviceFilter.serviceName = { $regex: searchTerm, $options: 'i' };

    const services = await serviceRepository.findByShopIds(shopIds, serviceFilter, 'serviceName shopId serviceFor imageUrl serviceType');

    return { shops: nearbyShops, services };
};
