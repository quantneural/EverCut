import mongoose from 'mongoose';
import bookingRepository from '../repositories/booking.repository.js';
import employeeRepository from '../repositories/employee.repository.js';
import serviceRepository from '../repositories/service.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import customerProfileRepo from '../repositories/customer-profile.repository.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/api-error.js';
import { isBookingInFuture, isWithinShopHours, getDayOfWeek, isWithinCancellationWindow } from '../utils/time.utils.js';
import { BOOKING_STATUS, MAX_RESCHEDULE_COUNT, CANCELLATION_WINDOW_HOURS } from '../utils/constants.js';

/**
 * Booking service — all booking business logic.
 */

// ── Customer: book a salon ───────────────────────────────────────────────

export const bookSalon = async (customerId, data) => {
    const { serviceId, employeeId, shopId, date, time, amount } = data;

    // Validate date/time is in future
    if (!isBookingInFuture(date, time)) {
        throw new BadRequestError('Cannot book in the past. Please select a future date and time.');
    }

    // Validate shop
    const shop = await shopRepository.findByIdWithFields(shopId, 'shopName address isOpen openTime closeTime availableDays');
    if (!shop) throw new NotFoundError('Shop');
    if (!shop.isOpen) throw new BadRequestError('Shop is currently closed');

    // Check available day
    const dayOfWeek = getDayOfWeek(date);
    if (!shop.availableDays.includes(dayOfWeek)) {
        throw new BadRequestError(`Shop is closed on ${dayOfWeek}`);
    }

    // Check shop hours
    if (!isWithinShopHours(time, shop.openTime, shop.closeTime)) {
        throw new BadRequestError('Booking time is outside shop hours');
    }

    // Normalize serviceIds
    const serviceIds = Array.isArray(serviceId) ? serviceId : [serviceId];

    // Validate services
    const services = await serviceRepository.findByIds(serviceIds, 'serviceName finalPrice');
    if (!services.length) throw new NotFoundError('Services');

    // Claim employee slot atomically
    const employee = await employeeRepository.claimSlot(employeeId, date, time, customerId, serviceIds);
    if (!employee) throw new BadRequestError('Employee not available at this date/time');

    // Calculate amount
    const totalAmount = amount || services.reduce((sum, s) => sum + (s.finalPrice || 0), 0);

    // Create booking
    const booking = await bookingRepository.create({
        customerId,
        serviceIds,
        employeeId,
        shopId,
        date,
        time,
        totalAmount,
        status: BOOKING_STATUS.CONFIRMED,
    });

    return {
        bookingId: booking._id,
        shopId,
        customerId,
        employee,
        services,
        date,
        time,
        totalAmount,
        status: booking.status,
    };
};

// ── Customer: get booking details ────────────────────────────────────────

export const getBookingDetails = async (bookingId, customerId) => {
    const booking = await bookingRepository.findByIdPopulated(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if ((booking.customerId._id || booking.customerId).toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only access your own bookings');
    }

    const services = await serviceRepository.findByIds(booking.serviceIds, 'serviceName finalPrice imageUrl serviceType');
    const totalAmount = services.reduce((sum, s) => sum + (s.finalPrice || 0), 0);

    return {
        bookingId: booking._id,
        customer: booking.customerId,
        employee: booking.employeeId,
        shop: booking.shopId,
        date: booking.date,
        time: booking.time,
        services,
        totalAmount,
        totalServices: services.length,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
    };
};

// ── Customer: cancel booking ─────────────────────────────────────────────

export const cancelBooking = async (bookingId, customerId) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if ((booking.customerId._id || booking.customerId).toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only cancel your own bookings');
    }

    if (booking.status === 'cancelled') throw new BadRequestError('Booking is already cancelled');
    if (booking.status === 'completed') throw new BadRequestError('Cannot cancel a completed booking');

    // Check if past
    if (!isBookingInFuture(booking.date.toISOString().split('T')[0], booking.time)) {
        throw new BadRequestError('Appointment has already passed');
    }

    // Check cancellation window
    if (isWithinCancellationWindow(booking.date, booking.time, CANCELLATION_WINDOW_HOURS)) {
        throw new BadRequestError(`Cancellation not allowed within ${CANCELLATION_WINDOW_HOURS} hours of appointment`);
    }

    // Release employee slot
    await employeeRepository.releaseSlot(booking.employeeId, booking.date.toISOString().split('T')[0], booking.time);

    return bookingRepository.updateStatus(bookingId, BOOKING_STATUS.CANCELLED);
};

// ── Customer: reschedule booking ─────────────────────────────────────────

export const rescheduleBooking = async (bookingId, customerId, newDate, newTime) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if ((booking.customerId._id || booking.customerId).toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only reschedule your own bookings');
    }

    if (!isBookingInFuture(booking.date.toISOString().split('T')[0], booking.time)) {
        throw new BadRequestError('Appointment has already passed');
    }

    if (isWithinCancellationWindow(booking.date, booking.time, CANCELLATION_WINDOW_HOURS)) {
        throw new BadRequestError(`Reschedule not allowed within ${CANCELLATION_WINDOW_HOURS} hours of appointment`);
    }

    if (booking.rescheduleCount >= MAX_RESCHEDULE_COUNT) {
        throw new BadRequestError('You can only reschedule once');
    }

    // Check for conflict
    const conflict = await bookingRepository.findConflict(booking.shopId, booking.employeeId, newDate, newTime, bookingId);
    if (conflict) throw new BadRequestError('This slot is already booked. Please choose another time.');

    // Release old slot, claim new
    const oldDate = booking.date.toISOString().split('T')[0];
    await employeeRepository.releaseSlot(booking.employeeId, oldDate, booking.time);

    const claimed = await employeeRepository.claimSlot(booking.employeeId, newDate, newTime);
    if (!claimed) {
        // Restore old slot if new claim fails
        await employeeRepository.claimSlot(booking.employeeId, oldDate, booking.time);
        throw new BadRequestError('Employee not available at the new date/time');
    }

    booking.date = newDate;
    booking.time = newTime;
    booking.rescheduleCount += 1;
    await booking.save();

    return booking;
};

// ── Customer: reorder (re-book) ──────────────────────────────────────────

export const reorderBooking = async (customerId, bookingId, newDate, newTime) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const existing = await bookingRepository.findById(bookingId, { session });
        if (!existing) { await session.abortTransaction(); session.endSession(); throw new NotFoundError('Original booking'); }

        // Prevent same date/time
        if (existing.date.toISOString().split('T')[0] === new Date(newDate).toISOString().split('T')[0] && existing.time === newTime) {
            await session.abortTransaction(); session.endSession();
            throw new BadRequestError('Please choose a different date or time');
        }

        if (!isBookingInFuture(newDate, newTime)) {
            await session.abortTransaction(); session.endSession();
            throw new BadRequestError('Cannot book for a past date/time');
        }

        const services = await serviceRepository.findByIds(existing.serviceIds, 'serviceName finalPrice', { session });
        const totalAmount = services.reduce((sum, s) => sum + (s.finalPrice || 0), 0);

        const employee = await employeeRepository.claimSlot(existing.employeeId, newDate, newTime, customerId, existing.serviceIds, { session });
        if (!employee) { await session.abortTransaction(); session.endSession(); throw new BadRequestError('Employee not available'); }

        const newBooking = await bookingRepository.create({
            customerId,
            serviceIds: existing.serviceIds,
            employeeId: existing.employeeId,
            shopId: existing.shopId,
            date: newDate,
            time: newTime,
            totalAmount,
            status: BOOKING_STATUS.CONFIRMED,
        }, { session });

        await session.commitTransaction();
        session.endSession();

        return { bookingId: newBooking._id, employee, services, totalAmount };
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
    }
};

// ── Customer: list bookings (past/upcoming/favorites) ────────────────────

export const getCustomerBookings = async (customerId, type) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (type === 'past') return bookingRepository.findPastByCustomer(customerId, today);
    if (type === 'upcoming') return bookingRepository.findUpcomingByCustomer(customerId, today);
    if (type === 'favorites') {
        const profile = await customerProfileRepo.findByUserIdPopulated(customerId);
        return profile?.favoriteBookings || [];
    }

    throw new BadRequestError('Invalid filter type. Use: past, upcoming, or favorites');
};

// ── Customer: toggle favorite ────────────────────────────────────────────

export const toggleFavorite = async (customerId, bookingId) => {
    const profile = await customerProfileRepo.findByUserId(customerId);
    const isFavorited = profile.favoriteBookings.some(id => id.toString() === bookingId);
    if (isFavorited) {
        return customerProfileRepo.removeFavoriteBooking(customerId, bookingId);
    }
    return customerProfileRepo.addFavoriteBooking(customerId, bookingId);
};

// ── Customer: booking confirmation ───────────────────────────────────────

export const getBookingConfirmation = async (bookingId, customerId) => {
    const booking = await bookingRepository.findByIdPopulated(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if ((booking.customerId._id || booking.customerId).toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only access your own bookings');
    }

    const services = await serviceRepository.findByIds(booking.serviceIds, 'serviceName finalPrice');
    const totalAmount = services.reduce((sum, s) => sum + (s.finalPrice || 0), 0);

    return {
        shopCoverUrl: booking.shopId?.coverUrl,
        date: booking.date,
        time: booking.time,
        services: services.map((s) => s.serviceName),
        totalAmount,
        totalServices: services.length,
    };
};

// ── Customer: update booking ─────────────────────────────────────────────

export const updateBooking = async (bookingId, customerId, { employeeId, date, time }) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if ((booking.customerId._id || booking.customerId).toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only update your own bookings');
    }

    const oldDate = booking.date.toISOString().split('T')[0];
    const isSameSlot = booking.employeeId.toString() === employeeId
        && oldDate === new Date(date).toISOString().split('T')[0]
        && booking.time === time;

    // Nothing to update if the slot hasn't changed
    if (isSameSlot) return booking;

    // Release the old slot first (always, regardless of employee change)
    await employeeRepository.releaseSlot(booking.employeeId, oldDate, booking.time);

    // Claim the new slot
    const employee = await employeeRepository.claimSlot(employeeId, date, time);
    if (!employee) {
        // Restore the old slot if the new claim fails
        await employeeRepository.claimSlot(booking.employeeId, oldDate, booking.time);
        throw new BadRequestError('Employee not available at this date/time');
    }

    booking.employeeId = employeeId;
    booking.date = date;
    booking.time = time;
    await booking.save();

    return booking;
};

// ── Customer: delete service from booking ────────────────────────────────

export const deleteServiceFromBooking = async (bookingId, customerId, serviceId) => {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');

    if ((booking.customerId._id || booking.customerId).toString() !== customerId.toString()) {
        throw new ForbiddenError('You can only retrieve from your own bookings');
    }

    booking.serviceIds = booking.serviceIds.filter((id) => id.toString() !== serviceId);

    if (booking.serviceIds.length === 0) {
        booking.totalAmount = 0;
    } else {
        const remaining = await serviceRepository.findByIds(booking.serviceIds, 'finalPrice');
        booking.totalAmount = remaining.reduce((sum, s) => sum + (s.finalPrice || 0), 0);
    }

    await booking.save();
    return { remainingServices: booking.serviceIds, totalAmount: booking.totalAmount };
};

// ── Customer: employee calendar ──────────────────────────────────────────

export const getEmployeeCalendar = async (employeeId, date) => {
    if (!date) throw new BadRequestError('Date query parameter is required');

    const employee = await employeeRepository.findByIdLean(employeeId, 'firstName lastName blockedDates workingHours');
    if (!employee) throw new NotFoundError('Employee');

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (date < todayStr) throw new BadRequestError('Cannot fetch past bookings');

    let bookings = await bookingRepository.findByEmployeeAndDate(employeeId, date);

    // For today, filter to future-only slots
    if (date === todayStr) {
        const { parseTimeToMinutes } = await import('../utils/time.utils.js');
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        bookings = bookings.filter((b) => {
            const m = parseTimeToMinutes(b.time);
            return m !== null && m > currentMinutes;
        });
    }

    return {
        employeeId,
        name: `${employee.firstName} ${employee.lastName}`,
        workingHours: employee.workingHours,
        blockedDates: employee.blockedDates,
        bookedSlots: bookings.map((b) => ({ date: b.date, time: b.time, bookingId: b._id })),
    };
};

// ── Barber-side: booking management ──────────────────────────────────────

export const getBookingsByShop = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const employeeIds = await employeeRepository.getIdsForShop(shop._id);
    const bookings = await bookingRepository.findByEmployeeIds(employeeIds);
    const numCustomers = await bookingRepository.getUniqueCustomerCount(employeeIds);

    return { bookings, numberOfEmployees: employeeIds.length, numberOfCustomers: numCustomers };
};

export const updateBookingStatus = async (bookingId, status, ownerId) => {
    const allowed = ['cancelled', 'completed', 'confirmed'];
    if (!allowed.includes(status)) throw new BadRequestError(`Invalid status. Allowed: ${allowed.join(', ')}`);

    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const booking = await bookingRepository.findById(bookingId);
    if (!booking || booking.shopId.toString() !== shop._id.toString()) {
        throw new ForbiddenError('You can only manage bookings for your own shop');
    }

    const updated = await bookingRepository.updateStatus(bookingId, status);
    if (!updated) throw new NotFoundError('Booking');
    return updated;
};

export const deleteBookingAfterPayment = async (bookingId, ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const booking = await bookingRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking');
    if (booking.shopId.toString() !== shop._id.toString()) {
        throw new ForbiddenError('You can only manage bookings for your own shop');
    }

    if (booking.paymentStatus !== 'success') throw new BadRequestError('Cannot delete unpaid booking');

    await employeeRepository.releaseSlot(booking.employeeId, booking.date.toISOString().split('T')[0], booking.time);
    await bookingRepository.deleteById(bookingId);
    return { message: 'Booking deleted and time slot freed' };
};

export const getBookingStats = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const employeeIds = await employeeRepository.getIdsForShop(shop._id);
    const [total, pending, completed, cancelled] = await Promise.all([
        bookingRepository.countAll({ employeeId: { $in: employeeIds } }),
        bookingRepository.countByStatus('pending', employeeIds),
        bookingRepository.countByStatus('completed', employeeIds),
        bookingRepository.countByStatus('cancelled', employeeIds),
    ]);
    return { total, pending, completed, cancelled };
};

export const getBookingsByStatusDetailed = async (ownerId, status) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop');

    const employeeIds = await employeeRepository.getIdsForShop(shop._id);
    return bookingRepository.findByStatusPopulated(status, employeeIds);
};
