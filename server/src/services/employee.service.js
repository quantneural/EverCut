import employeeRepository from '../repositories/employee.repository.js';
import shopRepository from '../repositories/shop.repository.js';
import logger from '../utils/logger.js';
import { BadRequestError, NotFoundError, ConflictError } from '../utils/api-error.js';
import cloudinary from '../config/cloudinary.config.js';

/**
 * Employee service — CRUD operations for shop employees.
 */

const parseJsonIfString = (value, fieldName) => {
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        throw new BadRequestError(`${fieldName} must be a valid JSON object`);
    }
};

const normalizeBlockedDates = (value) => {
    if (value === undefined) return undefined;
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return value;

    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [trimmed];
    }
};

const normalizeEmployeePayload = (data = {}) => {
    const normalized = { ...data };

    if (typeof normalized.phoneNumber === 'string') {
        normalized.phoneNumber = normalized.phoneNumber.trim();
    }

    if (normalized.workingHours !== undefined) {
        normalized.workingHours = parseJsonIfString(normalized.workingHours, 'workingHours');
    }

    if (normalized.blockedDates !== undefined) {
        normalized.blockedDates = normalizeBlockedDates(normalized.blockedDates);
    }

    return normalized;
};

const destroyCloudinaryAsset = async (publicId, context) => {
    if (!publicId) return;

    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        logger.warn('Employee image cleanup failed', {
            publicId,
            context,
            error: err.message,
        });
    }
};

export const addEmployee = async (ownerId, data, file) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const normalizedData = normalizeEmployeePayload(data);

    // Check for duplicate phone within this shop
    const existing = await employeeRepository.findByShopIdAndPhone(shop._id, normalizedData.phoneNumber);
    if (existing) throw new ConflictError('Employee with this phone number already exists');

    const employeeData = {
        shopId: shop._id,
        firstName: normalizedData.firstName,
        lastName: normalizedData.lastName,
        phoneNumber: normalizedData.phoneNumber,
        gender: normalizedData.gender,
        dateOfBirth: normalizedData.dateOfBirth,
        workingHours: normalizedData.workingHours?.start && normalizedData.workingHours?.end
            ? normalizedData.workingHours
            : { start: shop.openTime, end: shop.closeTime },
        blockedDates: normalizedData.blockedDates || [],
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

export const updateEmployee = async (ownerId, employeeId, data, file) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || String(employee.shopId) !== String(shop._id)) {
        throw new NotFoundError('Employee');
    }

    const normalizedData = normalizeEmployeePayload(data);
    const updateData = {};

    for (const field of ['firstName', 'lastName', 'phoneNumber', 'gender', 'dateOfBirth', 'workingHours', 'blockedDates']) {
        if (normalizedData[field] !== undefined) {
            updateData[field] = normalizedData[field];
        }
    }

    if (file) {
        updateData.photoUrl = file.path;
        updateData.cloudinaryId = file.public_id || file.filename;
    }

    if (Object.keys(updateData).length === 0) {
        throw new BadRequestError('No valid fields provided for update');
    }

    if (updateData.phoneNumber && updateData.phoneNumber !== employee.phoneNumber) {
        const existing = await employeeRepository.findByShopIdAndPhone(shop._id, updateData.phoneNumber);
        if (existing && String(existing._id) !== String(employeeId)) {
            if (updateData.cloudinaryId) {
                await destroyCloudinaryAsset(updateData.cloudinaryId, 'duplicate-phone');
            }
            throw new ConflictError('Employee with this phone number already exists');
        }
    }

    let updated;
    try {
        updated = await employeeRepository.updateById(employeeId, shop._id, updateData);
    } catch (err) {
        if (updateData.cloudinaryId) {
            await destroyCloudinaryAsset(updateData.cloudinaryId, 'update-failed');
        }
        throw err;
    }

    if (!updated) throw new NotFoundError('Employee');

    if (updateData.cloudinaryId && employee.cloudinaryId && employee.cloudinaryId !== updateData.cloudinaryId) {
        await destroyCloudinaryAsset(employee.cloudinaryId, 'replace-photo');
    }

    return updated;
};

export const deleteEmployee = async (ownerId, employeeId) => {
    const shop = await shopRepository.findByOwnerId(ownerId);
    if (!shop) throw new NotFoundError('Shop profile');

    const employee = await employeeRepository.softDelete(employeeId, shop._id);
    if (!employee) throw new NotFoundError('Employee');

    // Clean up Cloudinary photo
    if (employee.cloudinaryId) {
        await destroyCloudinaryAsset(employee.cloudinaryId, 'delete-employee');
    }

    return { message: 'Employee deleted successfully' };
};
