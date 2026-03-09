import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.config.js';
import config from '../config/index.js';

/**
 * All Multer upload configurations in one place.
 *
 * Previously, each controller (userAuth, barberEmployee, addCover, userPhoto)
 * had its own multer instance with duplicated storage config.
 */

// ── File filter ──────────────────────────────────────────────────────────

const imageFilter = (_req, file, cb) => {
    if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
};

const resolveActorKey = (req) => req.user?._id?.toString() || req.user?.firebaseUid || 'anonymous';

// ── Storage factories ────────────────────────────────────────────────────

const makeStorage = (folderFn) =>
    new CloudinaryStorage({
        cloudinary,
        params: (req, _file) => ({
            folder: folderFn(req),
            allowed_formats: config.upload.allowedImageFormats,
            transformation: [{ width: 800, height: 800, crop: 'limit' }],
        }),
    });

const coverStorage = new CloudinaryStorage({
    cloudinary,
    params: (req, _file) => ({
        folder: `evercut/shops/cover/${resolveActorKey(req)}`,
        allowed_formats: config.upload.allowedImageFormats,
        transformation: [{ width: 1200, height: 600, crop: 'limit' }],
    }),
});

// ── Exported upload middleware ────────────────────────────────────────────

/** Single customer profile photo */
export const uploadCustomerPhoto = multer({
    storage: makeStorage((req) => `evercut/customers/${resolveActorKey(req)}`),
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: imageFilter,
}).single('photo');

/** Single employee photo */
export const uploadEmployeePhoto = multer({
    storage: makeStorage((req) => `evercut/shops/employees/${resolveActorKey(req)}`),
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: imageFilter,
}).single('photo');

/** Shop cover image */
export const uploadShopCover = multer({
    storage: coverStorage,
    limits: { fileSize: config.upload.maxFileSize },
    fileFilter: imageFilter,
}).single('cover');

/** Multiple shop gallery photos */
export const uploadShopPhotos = multer({
    storage: makeStorage((req) => `evercut/shops/gallery/${resolveActorKey(req)}`),
    limits: {
        fileSize: config.upload.maxFileSize,
        files: config.upload.maxFiles,
    },
    fileFilter: imageFilter,
}).array('photos', config.upload.maxFiles);

/** Barber onboarding shop images (requires 3 files) */
export const uploadBarberOnboardingImages = multer({
    storage: makeStorage((req) => `evercut/shops/onboarding/${resolveActorKey(req)}`),
    limits: {
        fileSize: config.upload.maxFileSize,
        files: 3,
    },
    fileFilter: imageFilter,
}).fields([
    { name: 'shopImages', maxCount: 3 },
    { name: 'photos', maxCount: 3 },
]);
