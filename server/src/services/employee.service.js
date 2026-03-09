import employeeRepository from '../repositories/employee.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import { NotFoundError, ConflictError } from '../utils/api-error.js';
import cloudinary from '../config/cloudinary.config.js';

/**
 * Employee service — CRUD operations for shop employees.
 */

export const addEmployee = async (ownerId, data, file) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    // Check for duplicate phone within this shop
    const existing = await employeeRepository.findByShopIdAndPhone(shop._id, data.phoneNumber);
    if (existing) throw new ConflictError('Employee with this phone number already exists');

    const employeeData = {
        shopId: shop._id,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        gender: data.gender,
        dateOfBirth: data.dateOfBirth,
        workingHours: { start: shop.openTime, end: shop.closeTime },
        blockedDates: data.blockedDates || [],
    };

    if (file) {
        employeeData.photoUrl = file.path;
        employeeData.cloudinaryId = file.public_id || file.filename;
    }

    return employeeRepository.create(employeeData);
};

export const getEmployees = async (ownerId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');
    return employeeRepository.findByShopId(shop._id);
};

export const updateEmployee = async (ownerId, employeeId, data) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const updated = await employeeRepository.updateById(employeeId, shop._id, data);
    if (!updated) throw new NotFoundError('Employee');
    return updated;
};

export const deleteEmployee = async (ownerId, employeeId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employee = await employeeRepository.softDelete(employeeId, shop._id);
    if (!employee) throw new NotFoundError('Employee');

    // Clean up Cloudinary photo
    if (employee.cloudinaryId) {
        try { await cloudinary.uploader.destroy(employee.cloudinaryId); } catch { /* non-fatal */ }
    }

    return { message: 'Employee deleted successfully' };
};
