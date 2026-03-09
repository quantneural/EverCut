import * as shopService from '../../services/shop.service.js';
import * as serviceCatalogService from '../../services/service-catalog.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const getShopInfo = async (req, res, next) => {
    try {
        const result = await shopService.getShopInfoForCustomer(req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Shop info fetched'));
    } catch (err) {
        next(err);
    }
};

export const getNearbyShops = async (req, res, next) => {
    try {
        const { longitude, latitude } = req.query;
        const shops = await shopService.getNearbyShops([Number(longitude), Number(latitude)]);
        return res.status(200).json(ApiResponse.success(shops, 'Nearby shops fetched'));
    } catch (err) {
        next(err);
    }
};

export const getDoorstepShops = async (req, res, next) => {
    try {
        const shops = await shopService.getDoorstepShops();
        return res.status(200).json(ApiResponse.success(shops, 'Doorstep service shops'));
    } catch (err) {
        next(err);
    }
};

export const getServicesByGender = async (req, res, next) => {
    try {
        const { longitude, latitude, gender, search } = req.query;
        const result = await shopService.getNearbyServicesByGender(
            [Number(longitude), Number(latitude)],
            gender || 'unisex',
            search,
        );
        return res.status(200).json(ApiResponse.success(result, 'Services fetched'));
    } catch (err) {
        next(err);
    }
};

export const searchServices = async (req, res, next) => {
    try {
        const { query: q, gender } = req.query;
        const results = await serviceCatalogService.searchServices(q, gender);
        return res.status(200).json(ApiResponse.success(results, 'Search results'));
    } catch (err) {
        next(err);
    }
};

export const searchShops = async (req, res, next) => {
    try {
        const { query: q } = req.query;
        const results = await serviceCatalogService.searchShops(q);
        return res.status(200).json(ApiResponse.success(results, 'Shop search results'));
    } catch (err) {
        next(err);
    }
};
