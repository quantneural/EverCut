import mongoose from 'mongoose';

/**
 * Rating model.
 *
 * Changes from old schema:
 *   - `userId` → `customerId`
 *   - `advice` → `review` (clearer naming)
 *   - Unique compound index enforced (was commented out in old code)
 */
const ratingSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        shopId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Shop',
            required: true,
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            required: true,
        },
        review: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        reply: {
            text: {
                type: String,
                trim: true,
                maxlength: 500,
            },
            repliedAt: {
                type: Date,
            },
            repliedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        },
    },
    { timestamps: true },
);

// One rating per customer per shop (was commented out before)
ratingSchema.index({ shopId: 1, customerId: 1 }, { unique: true });
ratingSchema.index({ shopId: 1 });

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;
