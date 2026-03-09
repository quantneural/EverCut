import Employee from '../models/employee.model.js';

class EmployeeRepository {
    async create(data) {
        return Employee.create(data);
    }

    async findById(id) {
        return Employee.findById(id);
    }

    async findByShopId(shopId) {
        return Employee.find({ shopId, isActive: true });
    }

    async findByShopIdAndPhone(shopId, phoneNumber) {
        return Employee.findOne({ shopId, phoneNumber });
    }

    async updateById(id, shopId, data) {
        return Employee.findOneAndUpdate(
            { _id: id, shopId },
            { $set: data },
            { new: true, runValidators: true },
        );
    }

    /**
     * Atomically claim a slot for a booking.
     * Returns null if the slot is already taken or the date is blocked.
     */
    async claimSlot(employeeId, date, time, customerId, serviceIds) {
        return Employee.findOneAndUpdate(
            {
                _id: employeeId,
                bookedSlots: { $not: { $elemMatch: { date, time } } },
                blockedDates: { $ne: new Date(date) },
            },
            {
                $push: {
                    bookedSlots: { date, time },
                },
            },
            { new: true },
        ).select('firstName lastName photoUrl');
    }

    /**
     * Release a previously booked slot.
     */
    async releaseSlot(employeeId, date, time) {
        return Employee.findByIdAndUpdate(employeeId, {
            $pull: { bookedSlots: { date, time } },
        });
    }

    async getIdsForShop(shopId) {
        const employees = await Employee.find({ shopId, isActive: true }).select('_id');
        return employees.map((e) => e._id);
    }

    async softDelete(id, shopId) {
        return Employee.findOneAndUpdate(
            { _id: id, shopId },
            { deletedAt: new Date(), isActive: false },
            { new: true },
        );
    }

    async findByIdLean(id, fields) {
        return Employee.findById(id).select(fields).lean();
    }
}

export default new EmployeeRepository();
