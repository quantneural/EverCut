import userRepository from '../repositories/user.repository.js';
import customerProfileRepo from '../repositories/customer-profile.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import { ROLES } from '../utils/constants.js';
import { ConflictError, BadRequestError } from '../utils/api-error.js';
import { hashPin, validatePinCreation } from './pin.service.js';

/**
 * Onboarding service - handles first-time user and barber profile creation.
 */
export const createCustomerOnboarding = async (firebaseUid, profileData, file) => {
    const existing = await userRepository.findByFirebaseUid(firebaseUid);
    if (existing) throw new ConflictError('User already exists');

    if (!file) throw new BadRequestError('Profile photo is required');

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

export const createBarberOnboarding = async (firebaseUid, shopData) => {
    const existing = await userRepository.findByFirebaseUid(firebaseUid);
    if (existing) throw new ConflictError('Barber already exists');

    const pinResult = validatePinCreation(shopData.pin, shopData.confirmPin);
    if (!pinResult.isValid) throw new BadRequestError(pinResult.message);

    const pinHash = await hashPin(shopData.pin);

    let location = shopData.location;
    if (location && typeof location === 'string') {
        try {
            location = JSON.parse(location);
        } catch {
            throw new BadRequestError('Invalid location format');
        }
    }

    const user = await userRepository.create({
        firebaseUid,
        phoneNumber: shopData.phoneNumber,
        email: shopData.emailId,
        roleType: ROLES.BARBER,
    });

    const shop = await shopRepository.create({
        ownerId: user._id,
        shopName: shopData.shopName,
        ownerName: shopData.shopOwner,
        category: shopData.shopCategory,
        phoneNumber: shopData.phoneNumber,
        emailId: shopData.emailId,
        upiId: shopData.upiId,
        bio: shopData.bio,
        address: shopData.address,
        location,
        numberOfEmployees: shopData.numberOfEmployees,
        yearsOfExperience: shopData.yearsOfExperience,
        facilities: shopData.facilities,
        availableDays: shopData.availableDays,
        openTime: shopData.openTime,
        closeTime: shopData.closeTime,
        breakTimes: shopData.breakTimes,
        pinHash,
    });

    return { user, shop };
};
