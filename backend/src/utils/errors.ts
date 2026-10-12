/**
 * Custom error handling and error classes
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
  constructor(message: string, code: string = 'AUTHENTICATION_ERROR', details?: any) {
    super(401, message, code, details);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
  constructor(message: string, code: string = 'AUTHORIZATION_ERROR', details?: any) {
    super(403, message, code, details);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  constructor(message: string, code: string = 'VALIDATION_ERROR', details?: any) {
    super(400, message, code, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
  constructor(resource: string, code: string = 'NOT_FOUND') {
    super(404, `${resource} not found`, code);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  constructor(message: string, code: string = 'CONFLICT', details?: any) {
    super(409, message, code, details);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Internal server error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code: string = 'INTERNAL_ERROR', details?: any) {
    super(500, message, code, details);
    this.name = 'InternalServerError';
    Object.setPrototypeOf(this, InternalServerError.prototype);
  }
}

/**
 * Check if error is AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
