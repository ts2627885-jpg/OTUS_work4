/**
 * Application Exports Index
 * Central point for importing all application modules
 */

// Controllers
export { AuthController } from '@controllers/auth.controller';

// Services
export { AuthService } from '@services/auth.service';

// Repositories
export { UserRepository } from '@repositories/user.repository';

// Middleware
export {
  createAuthMiddleware,
  createOptionalAuthMiddleware
} from '@middleware/auth.middleware';
export {
  authorize,
  authorizeAny,
  authorizeRole,
  authorizeMinRole,
  RoleId
} from '@middleware/rbac.middleware';
export {
  errorHandler,
  asyncHandler,
  notFound
} from '@middleware/errorHandler.middleware';
export {
  requestLogger,
  healthCheck
} from '@middleware/requestLogger.middleware';

// Config
export {
  createDatabasePool,
  closeDatabasePool,
  getPool
} from '@config/database';

// Models
export type {
  IUser,
  IUserResponse,
  IAuthPayload,
  ILoginRequest,
  ILoginResponse,
  IRegisterRequest,
  IRole,
  IPermission
} from '@models/User';

export type {
  IAzs,
  IFuelSales,
  ITrafficData,
  ICompetitorPrice,
  IWeatherData,
  IAzsAccess
} from '@models/Azs';

export type {
  FuelType,
  IPrice,
  IPriceHistory,
  IUpdatePriceRequest,
  IPriceStats,
  ICompetitorPrices
} from '@models/Price';

export type {
  IRecommendation,
  IRecommendationRequest,
  IRecommendationResponse,
  IRecommendationParams,
  IElasticityData
} from '@models/Recommendation';

// Utilities
export { logger } from '@utils/logger';
export {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  InternalServerError
} from '@utils/errors';
export {
  validate,
  authValidators,
  azsValidators,
  priceValidators,
  paginationValidators
} from '@utils/validators';

// Main server
export { default as createApp } from './server';
