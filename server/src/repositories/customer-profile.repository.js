import CustomerProfile from '../models/customer-profile.model.js';

class CustomerProfileRepository {
    async create(data) {
        return CustomerProfile.create(data);
    }

    async findByUserId(userId) {
        return CustomerProfile.findOne({ userId });
    }

    async findById(id) {
        return CustomerProfile.findById(id);
    }

    async updateByUserId(userId, data) {
        return CustomerProfile.findOneAndUpdate(
            { userId },
            { $set: data },
            { new: true, runValidators: true },
        );
    }

    async addFavoriteBooking(userId, bookingId) {
        return CustomerProfile.findOneAndUpdate(
            { userId },
            { $addToSet: { favoriteBookings: bookingId } },
            { new: true },
        );
    }

    async removeFavoriteBooking(userId, bookingId) {
        return CustomerProfile.findOneAndUpdate(
            { userId },
            { $pull: { favoriteBookings: bookingId } },
            { new: true },
        );
    }

    async findByUserIdPopulated(userId) {
        return CustomerProfile.findOne({ userId }).populate({
            path: 'favoriteBookings',
            populate: [
                { path: 'serviceIds' },
                { path: 'employeeId', select: 'firstName lastName photoUrl' },
                { path: 'shopId', select: 'shopName address coverUrl' },
            ],
        });
    }
}

export default new CustomerProfileRepository();
