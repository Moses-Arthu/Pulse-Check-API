'use strict';

const Joi = require('joi');

/**
 * Joi schema for POST /monitors – register a new monitor.
 */
const registerSchema = Joi.object({
  id: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': '"id" cannot be empty',
    'any.required': '"id" is required',
  }),
  timeout: Joi.number().integer().min(5).required().messages({
    'number.base': '"timeout" must be a number',
    'number.integer': '"timeout" must be an integer',
    'number.min': '"timeout" must be at least 5 seconds',
    'any.required': '"timeout" is required',
  }),
  alert_email: Joi.string().email().required().messages({
    'string.email': '"alert_email" must be a valid email address',
    'any.required': '"alert_email" is required',
  }),
});

/**
 * Validate the register monitor request body.
 * @param {object} body
 * @returns {{ value, error }}
 */
const validateRegister = (body) => registerSchema.validate(body, { abortEarly: false });

module.exports = { validateRegister };
