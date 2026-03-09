import * as serviceCatalogService from '../../services/service-catalog.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const addService = async (req, res, next) => {
    try {
        const service = await serviceCatalogService.addService(req.user._id, req.body);
        return res.status(201).json(ApiResponse.success(service, 'Service added'));
    } catch (err) {
        next(err);
    }
};

export const getServices = async (req, res, next) => {
    try {
        const services = await serviceCatalogService.getServices(req.user._id);
        return res.status(200).json(ApiResponse.success(services, 'Services fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateService = async (req, res, next) => {
    try {
        const service = await serviceCatalogService.updateService(req.user._id, req.params.id, req.body);
        return res.status(200).json(ApiResponse.success(service, 'Service updated'));
    } catch (err) {
        next(err);
    }
};

export const deleteService = async (req, res, next) => {
    try {
        const result = await serviceCatalogService.deleteService(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Service deleted'));
    } catch (err) {
        next(err);
    }
};
