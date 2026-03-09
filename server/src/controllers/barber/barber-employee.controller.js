import * as employeeService from '../../services/employee.service.js';
import { ApiResponse } from '../../utils/api-response.js';

export const addEmployee = async (req, res, next) => {
    try {
        const employee = await employeeService.addEmployee(req.user._id, req.body, req.file);
        return res.status(201).json(ApiResponse.success(employee, 'Employee added'));
    } catch (err) {
        next(err);
    }
};

export const getEmployees = async (req, res, next) => {
    try {
        const employees = await employeeService.getEmployees(req.user._id);
        return res.status(200).json(ApiResponse.success(employees, 'Employees fetched'));
    } catch (err) {
        next(err);
    }
};

export const updateEmployee = async (req, res, next) => {
    try {
        const employee = await employeeService.updateEmployee(req.user._id, req.params.id, req.body);
        return res.status(200).json(ApiResponse.success(employee, 'Employee updated'));
    } catch (err) {
        next(err);
    }
};

export const deleteEmployee = async (req, res, next) => {
    try {
        const result = await employeeService.deleteEmployee(req.user._id, req.params.id);
        return res.status(200).json(ApiResponse.success(result, 'Employee deleted'));
    } catch (err) {
        next(err);
    }
};
