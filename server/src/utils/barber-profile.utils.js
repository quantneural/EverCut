const toPlainObject = (value) => {
    if (!value) return null;
    return typeof value.toObject === 'function' ? value.toObject() : { ...value };
};

const toBreakTimings = (breakTimes = []) => {
    if (!Array.isArray(breakTimes)) return [];

    return breakTimes.map((entry) => {
        const start = entry?.start ?? entry?.startsAt ?? null;
        const end = entry?.end ?? entry?.endsAt ?? null;

        return {
            start,
            end,
            startsAt: start,
            endsAt: end,
        };
    });
};

const toShopImages = (photos = []) => {
    if (!Array.isArray(photos)) return [];

    return [...photos]
        .sort((a, b) => {
            const left = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
            const right = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
            return left - right;
        })
        .map((photo) => photo?.photoUrl || photo?.path || photo?.url || null)
        .filter(Boolean);
};

export const serializeUpiDetails = (shop) => {
    const plainShop = toPlainObject(shop);
    if (!plainShop) return null;

    const upiAddress = plainShop.upiId || null;
    const isVerified = Boolean(upiAddress && plainShop.accountHolderName);

    return {
        accountHolderName: plainShop.accountHolderName || null,
        bankName: plainShop.bankName || null,
        upiId: upiAddress,
        upiAddress,
        isVerified,
        verificationStatus: isVerified ? 'verified' : 'unverified',
    };
};

/**
 * Returns the canonical shop document plus the onboarding-friendly aliases
 * used by the updated barber onboarding/profile flow.
 */
export const serializeBarberProfile = (shop, { photos } = {}) => {
    const plainShop = toPlainObject(shop);
    if (!plainShop) return null;

    const {
        pinHash,
        coverCloudinaryId,
        ownerPhotoCloudinaryId,
        ...safeShop
    } = plainShop;

    return {
        ...safeShop,
        firstName: safeShop.ownerFirstName,
        lastName: safeShop.ownerLastName,
        gender: safeShop.ownerGender,
        dateOfBirth: safeShop.ownerDateOfBirth,
        email: safeShop.emailId,
        shopOwner: safeShop.ownerName,
        shopCategory: safeShop.category,
        businessCategory: safeShop.category,
        shopLocation: safeShop.address,
        amenities: safeShop.facilities || [],
        workingDays: safeShop.availableDays || [],
        workingHours: {
            openTime: safeShop.openTime,
            closeTime: safeShop.closeTime,
            opensAt: safeShop.openTime,
            closesAt: safeShop.closeTime,
        },
        breakTimings: toBreakTimings(safeShop.breakTimes),
        upiAddress: safeShop.upiId,
        upiDetails: serializeUpiDetails(safeShop),
        coverImage: safeShop.coverUrl,
        photoUrl: safeShop.ownerPhotoUrl || null,
        profilePhotoUrl: safeShop.ownerPhotoUrl || null,
        ownerPhotoUrl: safeShop.ownerPhotoUrl || null,
        shopImages: toShopImages(photos),
    };
};
