import userRepository from '../repositories/user.repository.js';
import customerProfileRepo from '../repositories/customer-profile.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import { ROLES } from '../utils/constants.js';

/**
 * Auth service - handles session resolution after Firebase authentication.
 */
export const createSession = async (firebaseUid, phoneNumber) => {
    const existingUser = await userRepository.findByFirebaseUid(firebaseUid);

    if (existingUser) {
        // Update last login timestamp
        await userRepository.updateLastLogin(existingUser._id);

        let profile = null;
        if (existingUser.roleType === ROLES.CUSTOMER) {
            profile = await customerProfileRepo.findByUserId(existingUser._id);
        } else if (existingUser.roleType === ROLES.BARBER) {
            profile = await shopRepository.findByOwnerId(existingUser._id);
        }

        return {
            isNewUser: false,
            user: existingUser,
            profile,
        };
    }

    // New user - needs to complete their profile
    return {
        isNewUser: true,
        firebaseUid,
        phoneNumber,
    };
};
