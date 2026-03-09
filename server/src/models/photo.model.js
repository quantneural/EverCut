import mongoose from 'mongoose';
import { ALL_PHOTO_TYPES } from '../utils/constants.js';

/**
 * Photo model — linked to Shop via shopId.
 *
 * Change: `firebaseUid` (string) → `shopId` (ObjectId → Shop).
 */
const photoSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
            index: true,
        },
        photoUrl: {
            type: String,
            required: true,
        },
        cloudinaryId: {
            type: String,
            required: true,
        },
        photoName: {
            type: String,
            required: true,
        },
        photoType: {
            type: String,
            enum: ALL_PHOTO_TYPES,
            default: 'other',
        },
        description: {
            type: String,
            maxlength: 500,
        },
        fileSize: {
            type: Number,
        },
        mimeType: {
            type: String,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
photoSchema.index({ shopId: 1, isActive: 1 });

// ---------------------------------------------------------------------------
// Statics
// ---------------------------------------------------------------------------
photoSchema.statics.getActiveCountByShop = function (shopId) {
    return this.countDocuments({ shopId, isActive: true });
};

const Photo = mongoose.model('Photo', photoSchema);
export default Photo;
