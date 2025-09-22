const Joi = require('joi');
const httpStatus = require('http-status');
const pick = require('../utils/pick');
const ApiError = require('../utils/ApiError');

/**
 * Enhanced validation middleware with better error handling
 * @param {object} schema - Joi validation schema
 * @returns {function} Express middleware function
 */
const enhancedValidate = (schema) => (req, res, next) => {
  const validSchema = pick(schema, ['params', 'query', 'body']);
  const object = pick(req, Object.keys(validSchema));
  
  const { value, error } = Joi.compile(validSchema)
    .prefs({ 
      errors: { label: 'key' }, 
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    })
    .validate(object);

  if (error) {
    // Enhanced error message formatting
    const errorMessages = error.details.map((detail) => {
      let message = detail.message;
      
      // Clean up Joi error messages
      message = message.replace(/"/g, '');
      message = message.replace(/\[ref:.*?\]/g, '');
      
      // Add field context
      const field = detail.path.join('.');
      if (field && !message.includes(field)) {
        message = `${field}: ${message}`;
      }
      
      return message;
    });

    // Group errors by type for better user experience
    const requiredFields = [];
    const validationErrors = [];
    
    error.details.forEach((detail) => {
      if (detail.type === 'any.required') {
        requiredFields.push(detail.path.join('.'));
      } else {
        validationErrors.push(detail.message.replace(/"/g, ''));
      }
    });
    
    let finalMessage;
    if (requiredFields.length > 0) {
      finalMessage = `Required fields missing: ${requiredFields.join(', ')}`;
      if (validationErrors.length > 0) {
        finalMessage += `. Validation errors: ${validationErrors.join('; ')}`;
      }
    } else {
      finalMessage = validationErrors.join('; ');
    }
    
    const errorDetails = {
      type: 'ValidationError',
      requiredFields,
      validationErrors,
      totalErrors: error.details.length,
      details: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/"/g, ''),
        type: detail.type,
        value: detail.context?.value
      }))
    };

    return next(new ApiError(httpStatus.BAD_REQUEST, finalMessage, false, errorDetails));
  }
  
  Object.assign(req, value);
  return next();
};

/**
 * Validate request body only
 * @param {object} bodySchema - Joi schema for body validation
 * @returns {function} Express middleware function
 */
const validateBody = (bodySchema) => {
  return enhancedValidate({ body: bodySchema });
};

/**
 * Validate request params only
 * @param {object} paramsSchema - Joi schema for params validation
 * @returns {function} Express middleware function
 */
const validateParams = (paramsSchema) => {
  return enhancedValidate({ params: paramsSchema });
};

/**
 * Validate request query only
 * @param {object} querySchema - Joi schema for query validation
 * @returns {function} Express middleware function
 */
const validateQuery = (querySchema) => {
  return enhancedValidate({ query: querySchema });
};

/**
 * Required field checker middleware
 * @param {array} requiredFields - Array of required field names
 * @returns {function} Express middleware function
 */
const requireFields = (requiredFields) => (req, res, next) => {
  const missingFields = [];
  const emptyFields = [];
  
  requiredFields.forEach(field => {
    const value = req.body[field];
    
    if (value === undefined || value === null) {
      missingFields.push(field);
    } else if (typeof value === 'string' && value.trim() === '') {
      emptyFields.push(field);
    } else if (Array.isArray(value) && value.length === 0) {
      emptyFields.push(field);
    } else if (typeof value === 'object' && Object.keys(value).length === 0) {
      emptyFields.push(field);
    }
  });
  
  const errors = [];
  if (missingFields.length > 0) {
    errors.push(`Missing required fields: ${missingFields.join(', ')}`);
  }
  if (emptyFields.length > 0) {
    errors.push(`Empty required fields: ${emptyFields.join(', ')}`);
  }
  
  if (errors.length > 0) {
    const errorDetails = {
      type: 'RequiredFieldError',
      missingFields,
      emptyFields,
      requiredFields
    };
    
    return next(new ApiError(httpStatus.BAD_REQUEST, errors.join('. '), false, errorDetails));
  }
  
  next();
};

/**
 * Sanitize request data
 * @param {array} allowedFields - Array of allowed field names
 * @returns {function} Express middleware function
 */
const sanitizeFields = (allowedFields) => (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const sanitized = {};
    
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        sanitized[field] = req.body[field];
      }
    });
    
    // Log removed fields for security monitoring
    const removedFields = Object.keys(req.body).filter(field => !allowedFields.includes(field));
    if (removedFields.length > 0) {
      console.warn(`Removed unauthorized fields: ${removedFields.join(', ')} from ${req.method} ${req.path}`);
    }
    
    req.body = sanitized;
  }
  
  next();
};

/**
 * Validate content type
 * @param {array} allowedTypes - Array of allowed content types
 * @returns {function} Express middleware function
 */
const validateContentType = (allowedTypes = ['application/json']) => (req, res, next) => {
  if (req.method === 'GET' || req.method === 'DELETE') {
    return next();
  }
  
  const contentType = req.get('Content-Type');
  if (!contentType) {
    return next(new ApiError(httpStatus.BAD_REQUEST, 'Content-Type header is required'));
  }
  
  const isAllowed = allowedTypes.some(type => contentType.includes(type));
  if (!isAllowed) {
    return next(new ApiError(httpStatus.UNSUPPORTED_MEDIA_TYPE, `Content-Type must be one of: ${allowedTypes.join(', ')}`));
  }
  
  next();
};

module.exports = {
  enhancedValidate,
  validateBody,
  validateParams,
  validateQuery,
  requireFields,
  sanitizeFields,
  validateContentType,
};
