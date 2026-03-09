import bookingRepository from '../repositories/booking.repository.js';
import employeeRepository from '../repositories/employee.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import { NotFoundError } from '../utils/api-error.js';

/**
 * Earnings service — calculates barber earnings.
 */

export const getEarnings = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employeeIds = await employeeRepository.getIdsForShop(shop._id);
    if (!employeeIds.length) return { totalEarning: 0, lastMonthEarning: 0, todayEarning: 0 };

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Aggregate across all employees in the shop
    const results = await Promise.all(
        employeeIds.map((empId) =>
            bookingRepository.getEarningsAggregation(empId, startOfToday, endOfToday, startOfLastMonth, endOfLastMonth),
        ),
    );

    const combined = {
        totalEarning: 0,
        lastMonthEarning: 0,
        todayEarning: 0,
    };

    for (const result of results) {
        if (result.length > 0) {
            combined.totalEarning += result[0].totalEarning || 0;
            combined.lastMonthEarning += result[0].lastMonthEarning || 0;
            combined.todayEarning += result[0].todayEarning || 0;
        }
    }

    return combined;
};
