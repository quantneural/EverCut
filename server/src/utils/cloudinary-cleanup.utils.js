import cloudinary from '../config/cloudinary.config.js';
import logger from './logger.js';

const flattenUploads = (uploads) => {
    if (!uploads) return [];
    if (Array.isArray(uploads)) return uploads;
    if (uploads.path || uploads.public_id || uploads.filename) return [uploads];

    return Object.values(uploads).flatMap((value) => flattenUploads(value));
};

const resolveCloudinaryId = (file) => file?.public_id || file?.filename || file?.cloudinaryId;

export const cleanupUploadedCloudinaryFiles = async (uploads, context = {}) => {
    const files = flattenUploads(uploads)
        .map((file) => ({
            cloudinaryId: resolveCloudinaryId(file),
            originalname: file?.originalname,
        }))
        .filter((file) => file.cloudinaryId);

    if (!files.length) return;

    await Promise.allSettled(
        files.map(async (file) => {
            try {
                await cloudinary.uploader.destroy(file.cloudinaryId);
            } catch (error) {
                logger.error('Failed to cleanup uploaded Cloudinary asset', {
                    ...context,
                    cloudinaryId: file.cloudinaryId,
                    originalname: file.originalname,
                    error: error.message,
                });
            }
        }),
    );
};
