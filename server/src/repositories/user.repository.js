import User from '../models/user.model.js';

class UserRepository {
    async create(data) {
        return User.create(data);
    }

    async findById(id) {
        return User.findById(id);
    }

    async findByFirebaseUid(firebaseUid, options = {}) {
        return User.findOne({ firebaseUid }, null, options);
    }

    async findByEmail(email) {
        return User.findOne({ email });
    }

    async findByPhone(phoneNumber) {
        return User.findOne({ phoneNumber });
    }

    async updateById(id, data) {
        return User.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
    }

    async updateLastLogin(id) {
        return User.findByIdAndUpdate(id, { lastLoginAt: new Date() });
    }

    async softDelete(id) {
        return User.findByIdAndUpdate(id, { deletedAt: new Date(), isActive: false });
    }
}

export default new UserRepository();
