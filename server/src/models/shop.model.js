import mongoose from 'mongoose';
import {
    ALL_GENDERS,
    ALL_SERVICE_FOR,
    ALL_SHOP_AMENITIES,
    ALL_SHOP_CATEGORIES,
    DAYS_OF_WEEK,
} from '../utils/constants.js';

/**
 * Shop / Salon model — replaces the old BarberSetup.
 *
 * Key changes from old schema:
 *   - `ownerId` (ObjectId → User) replaces `firebaseUid` (String)
 *   - Renamed to "Shop" (domain-neutral term)
 *   - Added soft-delete, proper indexes, and validation
 */
const shopSchema = new mongoose.Schema(
    {
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        shopName: {
            type: String,
            required: true,
            trim: true,
        },
        ownerName: {
            type: String,
            required: true,
            trim: true,
        },
        ownerFirstName: {
            type: String,
            required: true,
            trim: true,
        },
        ownerLastName: {
            type: String,
            required: true,
            trim: true,
        },
        ownerGender: {
            type: String,
            enum: ALL_GENDERS,
            required: true,
        },
        ownerDateOfBirth: {
            type: Date,
            required: true,
        },
        category: {
            type: String,
            enum: ALL_SHOP_CATEGORIES,
            required: true,
        },
        targetCustomers: {
            type: String,
            enum: ALL_SERVICE_FOR,
            required: true,
        },
        phoneNumber: {
            type: String,
            required: true,
            trim: true,
        },
        emailId: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        upiId: {
            type: String,
            required: true,
            trim: true,
        },
        accountHolderName: {
            type: String,
            required: true,
            trim: true,
        },
        bankName: {
            type: String,
            required: true,
            trim: true,
        },
        bio: {
            type: String,
            default: '',
            maxlength: 500,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        location: {
            type: {
                type: String,
                enum: ['Point'],
                required: true,
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true,
            },
        },
        numberOfEmployees: {
            type: Number,
            required: true,
            min: 1,
            default: 1,
        },
        yearsOfExperience: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        facilities: [
            {
                type: String,
                enum: ALL_SHOP_AMENITIES,
                trim: true,
            },
        ],
        availableDays: [
            {
                type: String,
                enum: DAYS_OF_WEEK,
            },
        ],
        openTime: {
            type: String,
            required: true,
        },
        closeTime: {
            type: String,
            required: true,
        },
        breakTimes: [
            {
                start: { type: String, required: true },
                end: { type: String, required: true },
                _id: false,
            },
        ],
        coverUrl: {
            type: String,
            default: null,
        },
        coverCloudinaryId: {
            type: String,
            default: null,
        },
        ownerPhotoUrl: {
            type: String,
            default: null,
        },
        ownerPhotoCloudinaryId: {
            type: String,
            default: null,
        },
        pinHash: {
            type: String,
            required: true,
        },
        isOpen: {
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
shopSchema.index({ location: '2dsphere' });
shopSchema.index({ category: 1, targetCustomers: 1, isOpen: 1 });

// ---------------------------------------------------------------------------
// Soft-delete query middleware
// ---------------------------------------------------------------------------
shopSchema.pre(/^find/, function () {
    if (!this.getOptions()?.includeDeleted) {
        this.where({ deletedAt: null });
    }
});

const Shop = mongoose.model('Shop', shopSchema);
export default Shop;
