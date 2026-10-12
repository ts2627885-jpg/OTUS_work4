# 🏗️ АЗС-Пульт Backend API

Professional full-stack backend for АЗС-Пульт pricing management system, built with TypeScript, Express.js, PostgreSQL, and strict architectural patterns.

## 📋 Architecture Overview

The backend follows a **strict layered architecture** pattern:

```
┌─────────────────────────────────────────┐
│   HTTP Controllers (Request Handling)   │
├─────────────────────────────────────────┤
│   Services (Business Logic)             │
├─────────────────────────────────────────┤
│   Repositories (Data Access Layer)      │
├─────────────────────────────────────────┤
│   PostgreSQL Database                   │
└─────────────────────────────────────────┘
```

### Key Principles

- ✅ **Type Safety**: 100% TypeScript with strict mode, no `any` allowed
- ✅ **Separation of Concerns**: Controllers → Services → Repositories
- ✅ **Security First**: JWT auth, bcryptjs hashing, parameterized queries
- ✅ **Error Handling**: Custom error classes, global error handler
- ✅ **Logging**: Structured JSON logging for production
- ✅ **Testing**: Jest unit tests + integration tests
- ✅ **RBAC**: Role-based access control (4 roles: admin, manager, analyst, viewer)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Redis (optional, for caching)

### Installation

1. **Clone repository and install dependencies**

```bash
cd backend
npm install
```

2. **Setup environment**

```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Initialize database**

```bash
npm run db:migrate
npm run db:seed
```

4. **Start development server**

```bash
npm run dev
```

Server starts at `http://localhost:3001`

## 📂 Project Structure

```
backend/
├── src/
│   ├── controllers/         # HTTP request handlers
│   │   ├── auth.controller.ts
│   │   ├── azs.controller.ts
│   │   ├── prices.controller.ts
│   │   └── recommendations.controller.ts
│   │
│   ├── services/            # Business logic
│   │   ├── auth.service.ts
│   │   ├── azs.service.ts
│   │   ├── prices.service.ts
│   │   ├── recommendations.service.ts
│   │   └── import.service.ts
│   │
│   ├── repositories/        # Data Access Layer
│   │   ├── user.repository.ts
│   │   ├── azs.repository.ts
│   │   ├── price.repository.ts
│   │   └── recommendation.repository.ts
│   │
│   ├── middleware/          # Express middleware
│   │   ├── auth.middleware.ts          # JWT verification
│   │   ├── rbac.middleware.ts          # Role-based access control
│   │   ├── errorHandler.middleware.ts  # Global error handling
│   │   └── requestLogger.middleware.ts # Request logging
│   │
│   ├── models/              # TypeScript type definitions
│   │   ├── User.ts
│   │   ├── Azs.ts
│   │   ├── Price.ts
│   │   └── Recommendation.ts
│   │
│   ├── utils/               # Utility functions
│   │   ├── errors.ts        # Custom error classes
│   │   ├── logger.ts        # Structured logging
│   │   └── validators.ts    # Joi validation schemas
│   │
│   ├── config/              # Configuration
│   │   ├── database.ts      # DB connection pool
│   │   └── constants.ts     # App constants
│   │
│   ├── database/            # Database layer
│   │   ├── migrations/      # Migration scripts
│   │   └── seeds/           # Demo data
│   │
│   ├── index.ts             # Module exports
│   └── server.ts            # App entry point
│
├── tests/
│   ├── unit/                # Unit tests (services, repositories)
│   ├── integration/         # Integration tests (endpoints)
│   └── fixtures/            # Test data
│
├── jest.config.js           # Jest testing config
├── tsconfig.json            # TypeScript config
├── .eslintrc.json           # ESLint rules
├── .env.example             # Environment variables template
└── package.json
```

## 🔐 Authentication & Authorization

### JWT Authentication

1. User logs in with username/password
2. AuthService verifies credentials and generates JWT token
3. Client sends token in `Authorization: Bearer <token>` header
4. AuthMiddleware verifies token on protected routes
5. User info attached to `req.user`

### Roles & Permissions

```
1 = Admin       - Full system access
2 = Manager     - Can manage AZS and prices
3 = Analyst     - Can view recommendations and reports
4 = Viewer      - Read-only access
```

### Protected Routes Example

```typescript
// Requires authentication
app.get('/api/auth/profile', authenticateToken, controller.getProfile);

// Requires authentication + specific permission
app.post('/api/azs', authenticateToken, authorize('azs_create'), controller.create);

// Requires authentication + manager role or higher
app.delete('/api/azs/:id', authenticateToken, authorizeMinRole(RoleId.MANAGER), controller.delete);
```

## 📡 API Endpoints

### Authentication

```
POST   /api/auth/login              - Login user
POST   /api/auth/register           - Register new user
POST   /api/auth/logout             - Logout (requires auth)
GET    /api/auth/profile            - Get user profile (requires auth)
POST   /api/auth/refresh            - Refresh JWT token (requires auth)
```

### Gas Stations (АЗС)

```
GET    /api/azs                     - List all AZS
GET    /api/azs/:id                 - Get AZS details
POST   /api/azs                     - Create AZS (requires manager role)
PUT    /api/azs/:id                 - Update AZS (requires manager role)
DELETE /api/azs/:id                 - Delete AZS (requires manager role)
```

### Prices

```
GET    /api/prices                  - List prices
POST   /api/prices/:id              - Update price (requires manager role)
POST   /api/prices/import           - Import prices from CSV (requires manager role)
```

### Recommendations

```
GET    /api/recommendations         - Get price recommendations (requires analyst role)
POST   /api/recommendations/calculate - Calculate recommendations (requires analyst role)
```

### Admin

```
GET    /api/admin/users             - List users (requires admin role)
POST   /api/admin/users             - Create user (requires admin role)
PUT    /api/admin/users/:id         - Update user (requires admin role)
DELETE /api/admin/users/:id         - Delete user (requires admin role)
GET    /api/admin/logs              - View audit logs (requires admin role)
GET    /api/admin/stats             - View statistics (requires admin role)
```

## 🧪 Testing

### Run All Tests

```bash
npm run test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Generate Coverage Report

```bash
npm run test:coverage
```

Coverage threshold: **70% minimum** for all metrics (branches, functions, lines, statements)

### Test Examples

**Unit Test (mocked repository):**
```typescript
describe('AuthService', () => {
  it('should login user with correct credentials', async () => {
    mockUserRepository.findByUsername.mockResolvedValue(mockUser);
    const result = await authService.login('user', 'pass');
    expect(result).toHaveProperty('token');
  });
});
```

**Integration Test (real database):**
```typescript
describe('POST /api/auth/login', () => {
  it('should login with correct credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: 'pass' });
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveProperty('token');
  });
});
```

## 🔧 Development Commands

```bash
# Development server with auto-reload
npm run dev

# Build TypeScript to JavaScript
npm run build

# Watch mode for TypeScript compilation
npm run build:watch

# Run linter
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Type check (without emitting)
npm run type-check

# Database migrations
npm run db:migrate

# Seed demo data
npm run db:seed

# Run tests
npm run test

# Watch tests
npm run test:watch

# Coverage report
npm run test:coverage
```

## 📊 Database Schema

See `src/database/migrations/001_init_schema.sql` for complete schema.

Key tables:
- `users` - User accounts with roles
- `azs` - Gas stations
- `prices` - Current fuel prices
- `price_history` - Price change history
- `recommendations` - AI price recommendations
- `sales_data` - Sales metrics
- `traffic_data` - Traffic metrics
- `audit_logs` - User action audit trail
- `app_logs` - Application logs

## 🔒 Security

### Authentication & Authorization

- ✅ JWT tokens (24h expiration)
- ✅ bcryptjs password hashing (12 salt rounds)
- ✅ Role-based access control
- ✅ Refresh token support

### Data Security

- ✅ **SQL Injection**: Parameterized queries everywhere
- ✅ **XSS**: Input validation + output encoding
- ✅ **CSRF**: CSRF token middleware on state-changing requests
- ✅ **Secrets**: Environment variables, not in code
- ✅ **HTTPS**: Required in production (helmet + CORS headers)

### Error Handling

- ✅ Custom error classes (AuthenticationError, ValidationError, etc.)
- ✅ Consistent error responses
- ✅ No sensitive info in production errors
- ✅ Detailed errors in development mode

## 📝 Logging

Structured logging with different levels:

```typescript
// Development: colored console output
// Production: JSON format for log aggregation

logger.debug('Debug message', 'ModuleName');
logger.info('Info message', 'ModuleName');
logger.warn('Warning message', 'ModuleName');
logger.error('Error message', error, 'ModuleName');
logger.httpRequest(req, statusCode, duration, userId);
logger.auth('Login attempt', { username });
logger.query('SELECT...', params);
```

## 🐳 Docker

Build and run in Docker:

```bash
# Build image
docker build -t azs-pult-backend .

# Run container
docker run -p 3001:3001 \
  -e DB_HOST=postgres \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e JWT_SECRET=your-secret \
  azs-pult-backend
```

## 🚀 Production Deployment

### Environment Setup

```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-very-secure-secret-min-32-chars
DB_HOST=production-db-host
DB_PASSWORD=secure-password
FRONTEND_URL=https://azs-pult.com
LOG_LEVEL=info
```

### Performance Optimization

- Connection pooling (max 20 connections)
- Redis caching for frequently accessed data
- Query indexing on frequently filtered columns
- Gzip compression for responses
- Request rate limiting
- Database query optimization

### Monitoring

- Application logs in JSON format
- Structured logging for analysis
- Health check endpoint: `/health`
- Error tracking integration (Sentry, etc.)
- Performance monitoring (New Relic, DataDog, etc.)

## 📚 Additional Documentation

- [ARCHITECTURE.md](../ARCHITECTURE.md) - Detailed architecture documentation
- [API Documentation](./API.md) - Complete API reference
- [Contributing](../CONTRIBUTING.md) - Contribution guidelines

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/name`
2. Follow TypeScript strict mode
3. Write tests for new features
4. Ensure coverage > 70%
5. Run linter: `npm run lint:fix`
6. Create pull request

## 📄 License

ISC

---

**Version**: 2.1.0  
**Last Updated**: October 8, 2026  
**Status**: Production Ready
