import { ValidationError } from '@utils/errors';
/**
 * Validation schemas using Joi
 * Centralized validation for all inputs
 */

import * as Joi from 'joi';

/**
 * Authentication validators
 */
export const authValidators = {
  login: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(128).required(),
  }),

  register: Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .required()
      .messages({
        'string.pattern.base':
          'Password must contain uppercase, lowercase, number, and special character',
      }),
  }),
};

/**
 * AZS validators
 */
export const azsValidators = {
  create: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    location_region: Joi.string().min(2).max(50).required(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    manager_id: Joi.string().uuid().optional(),
  }),

  update: Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    location_region: Joi.string().min(2).max(50).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    is_active: Joi.boolean().optional(),
  }),
};

/**
 * Price validators
 */
export const priceValidators = {
  updatePrice: Joi.object({
    fuel_type: Joi.string().valid('AI-92', 'AI-95', 'AI-98', 'Diesel').required(),
    price: Joi.number().positive().max(1000).required(),
    effective_from: Joi.date().iso().optional(),
  }),
};

/**
 * Pagination validators
 */
export const paginationValidators = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
    sort_by: Joi.string().optional(),
    sort_order: Joi.string().valid('asc', 'desc').default('asc'),
  }),
};

/**
 * Validate data against schema
 */
export async function validate<T>(
  data: any,
  schema: Joi.Schema,
  options?: Joi.ValidationOptions
): Promise<T> {
  const { value, error } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    ...options,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    // 400 с понятным текстом вместо 500 (обработчик ошибок берёт statusCode из ValidationError)
    throw new ValidationError(
      details.map((d) => d.message).join('; '),
      'VALIDATION_ERROR',
      details
    );
  }

  return value as T;
}
