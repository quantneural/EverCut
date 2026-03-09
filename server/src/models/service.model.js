import mongoose from 'mongoose';
import { ALL_SERVICE_TYPES, ALL_SERVICE_FOR } from '../utils/constants.js';

/**
 * Service model — linked to Shop via shopId.
 *
 * Replaces the old Service model that used `firebaseUid`.
 */
const serviceSchema = new mongoose.Schema(
    {
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
            index: true,
        },
        serviceName: {
            type: String,
            required: true,
            trim: true,
        },
        serviceType: {
            type: String,
            enum: ALL_SERVICE_TYPES,
            required: true,
        },
        serviceFor: {
            type: String,
            enum: ALL_SERVICE_FOR,
            default: 'unisex',
        },
        imageUrl: {
            type: String,
            required: true,
        },

        // ── Single-service fields ──────────────────────────────────────────
        duration: { type: Number },
        actualPrice: { type: Number },
        offerPrice: { type: Number, default: 0 },
        finalPrice: { type: Number },

        // ── Bundled-service fields ─────────────────────────────────────────
        bundledServices: [{ type: String }],
        totalDuration: { type: Number },
        totalPrice: { type: Number },

        // ── Status ─────────────────────────────────────────────────────────
        isActive: {
            type: Boolean,
            default: true,
        },
        deletedAt: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true },
);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------
serviceSchema.index({ shopId: 1, isActive: 1 });
serviceSchema.index({ shopId: 1, serviceName: 1 }, { unique: true });
serviceSchema.index({ serviceFor: 1 });

// ---------------------------------------------------------------------------
// Soft-delete query middleware
// ---------------------------------------------------------------------------
serviceSchema.pre(/^find/, function () {
    if (!this.getOptions()?.includeDeleted) {
        this.where({ deletedAt: null });
    }
});

const Service = mongoose.model('Service', serviceSchema);
export default Service;
