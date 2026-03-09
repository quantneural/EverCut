import shopRepository from '../repositories/shop.repository.js';
import serviceRepository from '../repositories/service.repository.js';
import photoRepository from '../repositories/photo.repository.js';
import ratingRepository from '../repositories/rating.repository.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import {
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    ALL_SHOP_CATEGORIES,
    DAYS_OF_WEEK,
    NEARBY_DISTANCE_METERS,
    SHOP_CATEGORY,
} from '../utils/constants.js';

/**
 * Shop service business logic for barber profile management and customer discovery.
 */

export const getShopByOwner = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const { pinHash, ...safe } = shop.toObject();
    return safe;
};

const ALLOWED_UPDATE_FIELDS = [
    'shopName',
    'numberOfEmployees',
    'yearsOfExperience',
    'ownerName',
    'ownerFirstName',
    'ownerLastName',
    'ownerGender',
    'ownerDateOfBirth',
    'emailId',
    'upiId',
    'accountHolderName',
    'bankName',
    'location',
    'bio',
    'address',
    'category',
    'targetCustomers',
    'facilities',
    'availableDays',
    'openTime',
    'closeTime',
    'breakTimes',
];

const parseJsonIfString = (value) => {
    if (typeof value !== 'string') return value;
    return JSON.parse(value);
};

const parseArrayField = (value, fieldName) => {
    if (Array.isArray(value)) return value;

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];

        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
            return [trimmed];
        }
    }

    if (typeof value === 'object' && value !== null) return [value];

    throw new Error(`${fieldName} must be an array`);
};

const normalizeBreakTimes = (value) => {
    const rawBreakTimes = parseArrayField(value, 'breakTimes');

    return rawBreakTimes.map((entry, index) => {
        const parsed = parseJsonIfString(entry);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error(`breakTimes[${index}] must be an object`);
        }

        const start = parsed.start || parsed.startsAt;
        const end = parsed.end || parsed.endsAt;
        if (!start || !end) {
            throw new Error(`breakTimes[${index}] must include start and end`);
        }

        return { start, end };
    });
};

const normalizeUpdateBody = (body = {}) => {
    const normalized = { ...body };

    normalized.ownerFirstName = normalized.ownerFirstName || normalized.firstName;
    normalized.ownerLastName = normalized.ownerLastName || normalized.lastName;
    normalized.ownerGender = normalized.ownerGender || normalized.gender;
    normalized.ownerDateOfBirth = normalized.ownerDateOfBirth || normalized.dateOfBirth;

    normalized.emailId = normalized.emailId || normalized.email;
    normalized.upiId = normalized.upiId || normalized.upiAddress;
    normalized.address = normalized.address || normalized.shopLocation;
    normalized.category = normalized.category || normalized.shopCategory || normalized.businessCategory;
    normalized.facilities = normalized.facilities ?? normalized.amenities;
    normalized.availableDays = normalized.availableDays ?? normalized.workingDays;
    normalized.breakTimes = normalized.breakTimes ?? normalized.breakTimings;
    normalized.openTime = normalized.openTime || normalized.opensAt;
    normalized.closeTime = normalized.closeTime || normalized.closesAt;

    if (normalized.workingHours) {
        let parsedHours = normalized.workingHours;
        if (typeof normalized.workingHours === 'string') {
            try {
                parsedHours = JSON.parse(normalized.workingHours);
            } catch {
                parsedHours = {};
            }
        }
        normalized.openTime = normalized.openTime
            || parsedHours?.openTime
            || parsedHours?.opensAt;
        normalized.closeTime = normalized.closeTime
            || parsedHours?.closeTime
            || parsedHours?.closesAt;
    }

    return normalized;
};

const validateAndAssign = (key, value, updateData, errors) => {
    switch (key) {
        case 'category':
            if (!ALL_SHOP_CATEGORIES.includes(value)) {
                errors.push(`Invalid category. Must be one of: ${ALL_SHOP_CATEGORIES.join(', ')}`);
                return;
            }
            updateData[key] = value;
            return;

        case 'targetCustomers': {
            const targetRaw = String(value).trim().toLowerCase();
            const target = {
                men: 'male',
                women: 'female',
            }[targetRaw] || targetRaw;
            if (!ALL_SERVICE_FOR.includes(target)) {
                errors.push(`Invalid targetCustomers. Must be one of: ${ALL_SERVICE_FOR.join(', ')}`);
                return;
            }
            updateData[key] = target;
            return;
        }

        case 'numberOfEmployees': {
            const n = Number.parseInt(value, 10);
            if (Number.isNaN(n) || n < 1) {
                errors.push('numberOfEmployees must be >= 1');
                return;
            }
            updateData[key] = n;
            return;
        }

        case 'yearsOfExperience': {
            const n = Number.parseInt(value, 10);
            if (Number.isNaN(n) || n < 0) {
                errors.push('yearsOfExperience must be >= 0');
                return;
            }
            updateData[key] = n;
            return;
        }

        case 'emailId': {
            const email = String(value).trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push('Invalid email format');
                return;
            }
            updateData[key] = email;
            return;
        }

        case 'availableDays': {
            try {
                const days = parseArrayField(value, 'availableDays');
                const invalid = days.filter((day) => !DAYS_OF_WEEK.includes(day));
                if (invalid.length) {
                    errors.push(`Invalid days: ${invalid.join(', ')}`);
                    return;
                }
                updateData[key] = days;
            } catch (err) {
                errors.push(err.message);
            }
            return;
        }

        case 'facilities': {
            try {
                const amenities = parseArrayField(value, 'facilities');
                const invalid = amenities.filter((item) => !ALL_SHOP_AMENITIES.includes(item));
                if (invalid.length) {
                    errors.push(`Invalid amenities: ${invalid.join(', ')}`);
                    return;
                }
                updateData[key] = amenities;
            } catch (err) {
                errors.push(err.message);
            }
            return;
        }

        case 'breakTimes': {
            try {
                updateData[key] = normalizeBreakTimes(value);
            } catch (err) {
                errors.push(err.message);
            }
            return;
        }

        case 'location': {
            try {
                const location = parseJsonIfString(value);
                if (
                    location?.type !== 'Point'
                    || !Array.isArray(location.coordinates)
                    || location.coordinates.length !== 2
                ) {
                    errors.push('Invalid location format');
                    return;
                }
                updateData[key] = location;
            } catch {
                errors.push('Invalid location format');
            }
            return;
        }

        case 'ownerDateOfBirth': {
            const dt = new Date(value);
            if (Number.isNaN(dt.getTime())) {
                errors.push('ownerDateOfBirth must be a valid date');
                return;
            }
            updateData[key] = dt;
            return;
        }

        default:
            updateData[key] = value;
    }
};

export const updateBusinessInfo = async (ownerId, body) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const normalizedBody = normalizeUpdateBody(body);
    const updateData = {};
    const errors = [];

    for (const [key, value] of Object.entries(normalizedBody)) {
        if (!ALLOWED_UPDATE_FIELDS.includes(key)) continue;
        if (value === undefined || value === null || value === '') continue;

        validateAndAssign(key, value, updateData, errors);
    }

    if ((updateData.ownerFirstName || updateData.ownerLastName) && !updateData.ownerName) {
        const firstName = updateData.ownerFirstName || shop.ownerFirstName;
        const lastName = updateData.ownerLastName || shop.ownerLastName;
        updateData.ownerName = `${firstName || ''} ${lastName || ''}`.trim();
    }

    if (errors.length) throw new BadRequestError('Validation failed', errors);
    if (Object.keys(updateData).length === 0) {
        throw new BadRequestError('No valid fields provided for update');
    }

    const updated = await shopRepository.updateByOwnerId(ownerId, updateData);
    const { pinHash, ...safe } = updated.toObject();

    return {
        shop: safe,
        updatedFields: Object.keys(updateData),
    };
};

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

    if (typeof isOpen !== 'boolean') isOpen = !shop.isOpen;

    shop.isOpen = isOpen;
    await shop.save();

    return { isOpen: shop.isOpen };
};

export const getShopInfoForCustomer = async (shopId) => {
    const shop = await shopRepository.findById(shopId);
    if (!shop) throw new NotFoundError('Shop');

    const [singleServices, bundledServices, photos, ratingSummary] = await Promise.all([
        serviceRepository.findByShopIdAndType(
            shopId,
            'single',
            'serviceName duration finalPrice actualPrice offerPrice imageUrl serviceFor',
        ),
        serviceRepository.findByShopIdAndType(
            shopId,
            'bundled',
            'serviceName bundledServices totalDuration totalPrice imageUrl serviceFor',
        ),
        photoRepository.findByShopId(shopId, {}),
        ratingRepository.getShopSummary(shopId),
    ]);

    const ratings = await ratingRepository.findByShop(shopId);
    const formattedRatings = ratings.map((rating) => ({
        ratingId: rating._id,
        rating: rating.rating,
        review: rating.review,
        user: {
            firstName: rating.customerId?.firstName || 'Unknown',
            photoUrl: rating.customerId?.photoUrl || null,
        },
        createdAt: rating.createdAt,
    }));

    const { pinHash, ...safeShop } = shop.toObject();

    return {
        shop: safeShop,
        services: { single: singleServices, bundled: bundledServices },
        photos,
        ratings: { ...ratingSummary, details: formattedRatings },
    };
};

export const getNearbyShops = async (coordinates) => {
    return shopRepository.findNearby(
        coordinates,
        NEARBY_DISTANCE_METERS,
        'shopName address coverUrl facilities',
    );
};

export const getDoorstepShops = async () => {
    return shopRepository.findByCategory(
        SHOP_CATEGORY.DOOR_STEP,
        'shopName location coverUrl address',
    );
};

export const getNearbyServicesByGender = async (coordinates, gender, searchTerm) => {
    const nearbyShops = await shopRepository.findNearby(
        coordinates,
        NEARBY_DISTANCE_METERS,
        'shopName address coverUrl',
    );

    if (!nearbyShops.length) return { shops: [], services: [] };

    const shopIds = nearbyShops.map((shop) => shop._id);
    const serviceFilter = { serviceFor: { $regex: new RegExp(`^${gender}$`, 'i') } };
    if (searchTerm) serviceFilter.serviceName = { $regex: searchTerm, $options: 'i' };

    const services = await serviceRepository.findByShopIds(
        shopIds,
        serviceFilter,
        'serviceName shopId serviceFor imageUrl serviceType',
    );

    return { shops: nearbyShops, services };
};
