import mongoose from 'mongoose';
import { ALL_GENDERS } from '../utils/constants.js';

/**
 * Customer-specific profile data.
 *
 * Linked 1:1 to a User with roleType 'CUSTOMER'.
 * This separates customer-specific fields (name, DOB, photo, favourites)
 * from the core identity table – following the Persona-Based pattern.
 */
const customerProfileSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true,
            index: true,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        gender: {
            type: String,
            enum: ALL_GENDERS,
            required: true,
        },
        dateOfBirth: {
            type: Date,
            required: true,
        },
        address: {
            type: String,
            required: true,
            trim: true,
        },
        photoUrl: {
            type: String,
            default: null,
        },
        cloudinaryId: {
            type: String,
            default: null,
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
        favoriteBookings: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Booking',
            },
        ],
    },
    { timestamps: true },
);

// Geospatial index for location-based queries
customerProfileSchema.index({ location: '2dsphere' });

const CustomerProfile = mongoose.model('CustomerProfile', customerProfileSchema);
export default CustomerProfile;
