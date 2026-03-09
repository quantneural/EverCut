import customerProfileRepo from '../repositories/customer-profile.repository.js';
import userRepository from '../repositories/user.repository.js';
import { NotFoundError, BadRequestError } from '../utils/api-error.js';
import cloudinary from '../config/cloudinary.config.js';

/**
 * User (Customer) profile service.
 */

export const getProfile = async (userId) => {
    const profile = await customerProfileRepo.findByUserId(userId);
    if (!profile) throw new NotFoundError('Customer profile');
    return profile;
};

export const getHomeProfile = async (userId) => {
    const profile = await customerProfileRepo.findByUserId(userId);
    if (!profile) throw new NotFoundError('Customer profile');

    return {
        photo: profile.photoUrl || null,
        name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
        address: profile.address || '',
    };
};

export const updateProfile = async (userId, data, file) => {
    const profile = await customerProfileRepo.findByUserId(userId);
    if (!profile) throw new NotFoundError('Customer profile');

    // Handle photo replacement
    if (file) {
        // Delete old photo from Cloudinary
        if (profile.cloudinaryId) {
            try {
                await cloudinary.uploader.destroy(profile.cloudinaryId);
            } catch {
                // Non-fatal — log but continue
            }
        }
        data.photoUrl = file.path;
        data.cloudinaryId = file.filename || file.public_id;
    }

    // Parse location if string
    if (data.location && typeof data.location === 'string') {
        try {
            data.location = JSON.parse(data.location);
        } catch {
            throw new BadRequestError('Invalid location format');
        }
    }

    // Update profile (only provided fields overwrite)
    const updated = await customerProfileRepo.updateByUserId(userId, data);

    // Also update email on User model if changed
    if (data.email) {
        await userRepository.updateById(userId, { email: data.email });
    }

    return updated;
};
