/**
 * Application-wide constants and enum-like values.
 * Import from here instead of scattering magic strings.
 */

// ---------------------------------------------------------------------------
// User Roles
// ---------------------------------------------------------------------------

export const ROLES = Object.freeze({
    CUSTOMER: 'CUSTOMER',
    BARBER: 'BARBER',
    ADMIN: 'ADMIN',
});

export const ALL_ROLES = Object.values(ROLES);

// ---------------------------------------------------------------------------
// Booking Statuses
// ---------------------------------------------------------------------------

export const BOOKING_STATUS = Object.freeze({
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no-show',
});

export const ALL_BOOKING_STATUSES = Object.values(BOOKING_STATUS);

// ---------------------------------------------------------------------------
// Payment Statuses
// ---------------------------------------------------------------------------

export const PAYMENT_STATUS = Object.freeze({
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
});

export const ALL_PAYMENT_STATUSES = Object.values(PAYMENT_STATUS);

// ---------------------------------------------------------------------------
// Shop Categories
// ---------------------------------------------------------------------------

export const SHOP_CATEGORY = Object.freeze({
    SALON: 'Salon',
    BEAUTY_PARLOUR: 'Beauty Parlour',
    BARBER: 'Barber',
    DOOR_STEP: 'Door-Step',
});

export const ALL_SHOP_CATEGORIES = Object.values(SHOP_CATEGORY);

// ---------------------------------------------------------------------------
// Days of Week
// ---------------------------------------------------------------------------

export const DAYS_OF_WEEK = Object.freeze([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
]);

// ---------------------------------------------------------------------------
// Service Types
// ---------------------------------------------------------------------------

export const SERVICE_TYPE = Object.freeze({
    SINGLE: 'single',
    BUNDLED: 'bundled',
});

export const ALL_SERVICE_TYPES = Object.values(SERVICE_TYPE);

// ---------------------------------------------------------------------------
// Service Gender
// ---------------------------------------------------------------------------

export const SERVICE_FOR = Object.freeze({
    MALE: 'male',
    FEMALE: 'female',
    UNISEX: 'unisex',
});

export const ALL_SERVICE_FOR = Object.values(SERVICE_FOR);

// ---------------------------------------------------------------------------
// Photo Types
// ---------------------------------------------------------------------------

export const PHOTO_TYPE = Object.freeze({
    SHOP_INTERIOR: 'shop_interior',
    SHOP_EXTERIOR: 'shop_exterior',
    WORK_SAMPLE: 'work_sample',
    TEAM_PHOTO: 'team_photo',
    CERTIFICATE: 'certificate',
    OTHER: 'other',
});

export const ALL_PHOTO_TYPES = Object.values(PHOTO_TYPE);

// ---------------------------------------------------------------------------
// Gender
// ---------------------------------------------------------------------------

export const GENDER = Object.freeze({
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
});

export const ALL_GENDERS = Object.values(GENDER);

// ---------------------------------------------------------------------------
// Miscellaneous
// ---------------------------------------------------------------------------

export const MAX_RESCHEDULE_COUNT = 1;
export const CANCELLATION_WINDOW_HOURS = 2;
export const NEARBY_DISTANCE_METERS = 2000;
export const MAX_PHOTOS_PER_SHOP = 10;
