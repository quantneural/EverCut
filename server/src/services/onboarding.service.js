import userRepository from '../repositories/user.repository.js';
import customerProfileRepo from '../repositories/customer-profile.repository.js';
import photoRepository from '../repositories/photo.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import {
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    DAYS_OF_WEEK,
    ROLES,
} from '../utils/constants.js';
import { serializeBarberProfile } from '../utils/barber-profile.utils.js';
import { ConflictError, BadRequestError } from '../utils/api-error.js';
import { hashPin, validatePinCreation } from './pin.service.js';

/**
 * Onboarding service - handles first-time user and barber profile creation.
 */

const parseJsonIfString = (value, fieldName) => {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        throw new BadRequestError(`Invalid ${fieldName} format`);
    }
};

const toArray = (value, fieldName) => {
    if (value === undefined || value === null || value === '') return [];
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

    if (typeof value === 'object') return [value];

    throw new BadRequestError(`${fieldName} must be an array`);
};

const toPositiveInteger = (value, fallback = 1) => {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n) || n < 1) throw new BadRequestError('numberOfEmployees must be >= 1');
    return n;
};

const toNonNegativeInteger = (value, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number.parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) throw new BadRequestError('yearsOfExperience must be >= 0');
    return n;
};

const normalizeLocation = (value) => {
    const parsed = parseJsonIfString(value, 'location');
    if (!parsed || typeof parsed !== 'object') throw new BadRequestError('location is required');
    if (parsed.type !== 'Point') throw new BadRequestError('location.type must be "Point"');
    if (!Array.isArray(parsed.coordinates) || parsed.coordinates.length !== 2) {
        throw new BadRequestError('location.coordinates must contain [longitude, latitude]');
    }

    const [longitude, latitude] = parsed.coordinates;
    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
        throw new BadRequestError('location.coordinates must be numbers');
    }

    return parsed;
};

const normalizeBreakTimes = (value) => {
    const times = toArray(value, 'breakTimes');
    return times.map((entry, index) => {
        const raw = parseJsonIfString(entry, `breakTimes[${index}]`);
        if (!raw || typeof raw !== 'object') {
            throw new BadRequestError(`breakTimes[${index}] must be an object`);
        }

        const start = raw.start || raw.startsAt;
        const end = raw.end || raw.endsAt;

        if (!start || !end) {
            throw new BadRequestError(`breakTimes[${index}] must include start and end`);
        }

        return { start, end };
    });
};

const extractShopImages = (files) => {
    if (!files) return [];
    if (Array.isArray(files)) return files;

    const onboardingImages = files.shopImages || [];
    const fallbackPhotos = files.photos || [];
    return [...onboardingImages, ...fallbackPhotos];
};

const normalizeBarberOnboardingInput = (authUser, shopData) => {
    const firstName = String(shopData.firstName || shopData.ownerFirstName || '').trim();
    const lastName = String(shopData.lastName || shopData.ownerLastName || '').trim();
    const ownerNameFromNameParts = `${firstName} ${lastName}`.trim();
    const ownerName = String(shopData.shopOwner || shopData.ownerName || ownerNameFromNameParts).trim();

    const emailId = String(shopData.emailId || shopData.email || '').trim().toLowerCase();
    const phoneNumber = String(shopData.phoneNumber || authUser?.phoneNumber || '').trim();
    const category = shopData.shopCategory || shopData.businessCategory || shopData.category;
    const address = String(shopData.address || shopData.shopLocation || '').trim();
    const upiId = String(shopData.upiId || shopData.upiAddress || '').trim();

    const workingHours = parseJsonIfString(shopData.workingHours, 'workingHours');
    const openTime = String(
        shopData.openTime
            || shopData.opensAt
            || workingHours?.openTime
            || workingHours?.opensAt
            || '',
    ).trim();
    const closeTime = String(
        shopData.closeTime
            || shopData.closesAt
            || workingHours?.closeTime
            || workingHours?.closesAt
            || '',
    ).trim();

    const facilitiesInput = shopData.facilities ?? shopData.amenities ?? [];
    const facilities = toArray(facilitiesInput, 'facilities')
        .map((facility) => String(facility).trim())
        .filter(Boolean);
    const invalidFacilities = facilities.filter((facility) => !ALL_SHOP_AMENITIES.includes(facility));
    if (invalidFacilities.length) {
        throw new BadRequestError(`Invalid amenities: ${invalidFacilities.join(', ')}`);
    }

    const availableDaysInput = shopData.availableDays ?? shopData.workingDays ?? [];
    const availableDays = toArray(availableDaysInput, 'availableDays')
        .map((day) => String(day).trim())
        .filter(Boolean);
    const invalidDays = availableDays.filter((day) => !DAYS_OF_WEEK.includes(day));
    if (invalidDays.length) {
        throw new BadRequestError(`Invalid working days: ${invalidDays.join(', ')}`);
    }

    const breakTimesInput = shopData.breakTimes ?? shopData.breakTimings ?? [];
    const breakTimes = normalizeBreakTimes(breakTimesInput);

    const targetCustomersRaw = String(shopData.targetCustomers || '').trim().toLowerCase();
    const targetCustomers = {
        men: 'male',
        women: 'female',
    }[targetCustomersRaw] || targetCustomersRaw;
    if (!ALL_SERVICE_FOR.includes(targetCustomers)) {
        throw new BadRequestError(`targetCustomers must be one of: ${ALL_SERVICE_FOR.join(', ')}`);
    }

    const accountHolderName = String(shopData.accountHolderName || '').trim();
    const bankName = String(shopData.bankName || '').trim();
    const location = normalizeLocation(shopData.location);

    if (!firstName || !lastName) {
        throw new BadRequestError('firstName and lastName are required');
    }
    if (!shopData.gender && !shopData.ownerGender) {
        throw new BadRequestError('gender is required');
    }
    if (!shopData.dateOfBirth && !shopData.ownerDateOfBirth) {
        throw new BadRequestError('dateOfBirth is required');
    }
    if (!ownerName) {
        throw new BadRequestError('shopOwner/ownerName or firstName + lastName are required');
    }
    if (!emailId) {
        throw new BadRequestError('email is required');
    }
    if (!phoneNumber) {
        throw new BadRequestError('phoneNumber is required');
    }
    if (!category) {
        throw new BadRequestError('shopCategory/businessCategory is required');
    }
    if (!address) {
        throw new BadRequestError('address or shopLocation is required');
    }
    if (!availableDays.length) {
        throw new BadRequestError('At least one working day is required');
    }
    if (!openTime || !closeTime) {
        throw new BadRequestError('openTime and closeTime are required');
    }
    if (!upiId) {
        throw new BadRequestError('upiId or upiAddress is required');
    }
    if (!accountHolderName || !bankName) {
        throw new BadRequestError('accountHolderName and bankName are required');
    }

    return {
        firstName,
        lastName,
        gender: shopData.gender || shopData.ownerGender,
        dateOfBirth: shopData.dateOfBirth || shopData.ownerDateOfBirth,
        ownerName,
        shopName: String(shopData.shopName || '').trim(),
        category,
        targetCustomers,
        phoneNumber,
        emailId,
        accountHolderName,
        bankName,
        upiId,
        bio: shopData.bio || '',
        address,
        location,
        numberOfEmployees: toPositiveInteger(shopData.numberOfEmployees, 1),
        yearsOfExperience: toNonNegativeInteger(shopData.yearsOfExperience, 0),
        facilities,
        availableDays,
        openTime,
        closeTime,
        breakTimes,
        pin: shopData.pin,
        confirmPin: shopData.confirmPin,
    };
};

const ensureUniqueUserIdentity = async ({ firebaseUid, email, phoneNumber }) => {
    const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
    const normalizedPhoneNumber = phoneNumber ? String(phoneNumber).trim() : null;

    const [emailOwner, phoneOwner] = await Promise.all([
        normalizedEmail ? userRepository.findByEmail(normalizedEmail) : null,
        normalizedPhoneNumber ? userRepository.findByPhone(normalizedPhoneNumber) : null,
    ]);

    if (emailOwner && emailOwner.firebaseUid !== firebaseUid) {
        throw new ConflictError('Email already registered');
    }

    if (phoneOwner && phoneOwner.firebaseUid !== firebaseUid) {
        throw new ConflictError('Phone number already registered');
    }
};

export const createCustomerOnboarding = async (firebaseUid, profileData, file) => {
    const existing = await userRepository.findByFirebaseUid(firebaseUid);
    if (existing) throw new ConflictError('User already exists');

    if (!file) throw new BadRequestError('Profile photo is required');

    await ensureUniqueUserIdentity({
        firebaseUid,
        email: profileData.email,
        phoneNumber: profileData.phoneNumber,
    });

    let location = profileData.location;
    if (location && typeof location === 'string') {
        try {
            location = JSON.parse(location);
        } catch {
            throw new BadRequestError('Invalid location format');
        }
    }

    const user = await userRepository.create({
        firebaseUid,
        phoneNumber: profileData.phoneNumber,
        email: profileData.email,
        roleType: ROLES.CUSTOMER,
    });

    const profile = await customerProfileRepo.create({
        userId: user._id,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        gender: profileData.gender,
        dateOfBirth: profileData.dateOfBirth,
        address: profileData.address,
        location,
        photoUrl: file.path,
        cloudinaryId: file.filename || file.public_id,
    });

    return { user, profile };
};

export const createBarberOnboarding = async (firebaseUid, authUser, shopData, files) => {
    const existing = await userRepository.findByFirebaseUid(firebaseUid);
    if (existing) throw new ConflictError('Barber already exists');

    const normalized = normalizeBarberOnboardingInput(authUser, shopData);
    await ensureUniqueUserIdentity({
        firebaseUid,
        email: normalized.emailId,
        phoneNumber: normalized.phoneNumber,
    });

    const onboardingImages = extractShopImages(files);
    if (onboardingImages.length !== 3) {
        throw new BadRequestError('Please upload exactly 3 shop images for onboarding');
    }

    const pinResult = validatePinCreation(normalized.pin, normalized.confirmPin);
    if (!pinResult.isValid) throw new BadRequestError(pinResult.message);

    const pinHash = await hashPin(normalized.pin);

    const coverImage = onboardingImages[0];
    const coverUrl = coverImage.path;
    const coverCloudinaryId = coverImage.public_id || coverImage.filename;

    const user = await userRepository.create({
        firebaseUid,
        phoneNumber: normalized.phoneNumber,
        email: normalized.emailId,
        roleType: ROLES.BARBER,
    });

    const createdShop = await shopRepository.create({
        ownerId: user._id,
        shopName: normalized.shopName,
        ownerName: normalized.ownerName,
        ownerFirstName: normalized.firstName,
        ownerLastName: normalized.lastName,
        ownerGender: normalized.gender,
        ownerDateOfBirth: normalized.dateOfBirth,
        category: normalized.category,
        targetCustomers: normalized.targetCustomers,
        phoneNumber: normalized.phoneNumber,
        emailId: normalized.emailId,
        accountHolderName: normalized.accountHolderName,
        bankName: normalized.bankName,
        upiId: normalized.upiId,
        bio: normalized.bio,
        address: normalized.address,
        location: normalized.location,
        numberOfEmployees: normalized.numberOfEmployees,
        yearsOfExperience: normalized.yearsOfExperience,
        facilities: normalized.facilities,
        availableDays: normalized.availableDays,
        openTime: normalized.openTime,
        closeTime: normalized.closeTime,
        breakTimes: normalized.breakTimes,
        coverUrl,
        coverCloudinaryId,
        pinHash,
    });

    const photos = [];
    for (const [index, file] of onboardingImages.entries()) {
        const photo = await photoRepository.create({
            shopId: createdShop._id,
            photoUrl: file.path,
            cloudinaryId: file.public_id || file.filename,
            photoName: file.originalname || `onboarding-shop-image-${index + 1}`,
            photoType: 'shop_interior',
            description: 'Uploaded during onboarding',
            fileSize: file.size,
            mimeType: file.mimetype,
        });
        photos.push(photo);
    }

    return {
        user,
        shop: serializeBarberProfile(createdShop, { photos }),
        photos,
    };
};
