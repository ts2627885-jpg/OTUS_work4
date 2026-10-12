# 🏗️ АЗС-Пульт v2.1 - Архитектура и Design Patterns

## Обзор

АЗС-Пульт v2.1 - это полнофункциональная система управления ценовой политикой для сетей АЗС, построенная на современном full-stack стеке с TypeScript, и следующая лучшим практикам enterprise-разработки.

## 📊 Архитектурные слои

### Backend Architecture

```
┌─────────────────────────────────────────────┐
│          Express HTTP Server                │
├─────────────────────────────────────────────┤
│ Routes / Controllers (Express middleware)   │
├─────────────────────────────────────────────┤
│ Services (Business Logic)                   │
├─────────────────────────────────────────────┤
│ Repositories / DAL (Database Access)        │
├─────────────────────────────────────────────┤
│ Models / Interfaces (TypeScript types)      │
├─────────────────────────────────────────────┤
│ PostgreSQL Database + Redis Cache           │
└─────────────────────────────────────────────┘
```

### Структура Проекта

```
backend/
├── src/
│   ├── controllers/           # HTTP request handlers
│   │   ├── auth.controller.ts
│   │   ├── azs.controller.ts
│   │   ├── prices.controller.ts
│   │   └── recommendations.controller.ts
│   │
│   ├── services/              # Business logic layer
│   │   ├── auth.service.ts
│   │   ├── azs.service.ts
│   │   ├── prices.service.ts
│   │   ├── recommendations.service.ts
│   │   └── import.service.ts
│   │
│   ├── repositories/          # Data Access Layer
│   │   ├── user.repository.ts
│   │   ├── azs.repository.ts
│   │   ├── price.repository.ts
│   │   └── recommendation.repository.ts
│   │
│   ├── middleware/            # Express middleware
│   │   ├── auth.middleware.ts        # JWT verification
│   │   ├── rbac.middleware.ts        # Role-based access control
│   │   ├── errorHandler.middleware.ts
│   │   └── requestLogger.middleware.ts
│   │
│   ├── models/                # TypeScript interfaces & types
│   │   ├── User.ts
│   │   ├── Azs.ts
│   │   ├── Price.ts
│   │   └── Recommendation.ts
│   │
│   ├── utils/                 # Utilities
│   │   ├── errors.ts          # Custom error classes
│   │   ├── logger.ts          # Structured logging
│   │   ├── validators.ts      # Joi validation schemas
│   │   └── helpers.ts         # Helper functions
│   │
│   ├── config/                # Configuration
│   │   ├── database.ts        # DB connection
│   │   ├── constants.ts       # App constants
│   │   └── environment.ts     # Env variables
│   │
│   ├── database/              # Database layer
│   │   ├── migrations/        # Migration scripts
│   │   │   └── 001_init_schema.sql
│   │   └── seeds/             # Demo data
│   │       └── seed.ts
│   │
│   └── server.ts              # App entry point
│
├── tests/
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── fixtures/              # Test data
│
├── tsconfig.json              # TypeScript config
├── jest.config.js             # Jest testing config
├── .eslintrc.json             # ESLint rules
└── package.json
```

## 🔄 Слои приложения

### 1. Controllers (HTTP Layer)

Обрабатывает HTTP запросы, валидирует входные данные, вызывает сервисы.

```typescript
// ✅ ПРАВИЛЬНО: Controllers не содержат бизнес-логику
export class AuthController {
  constructor(private authService: AuthService) {}

  async login(req: Request, res: Response): Promise<void> {
    const validated = await validate(req.body, authValidators.login);
    const result = await this.authService.login(validated);
    res.json(result);
  }
}

// ❌ НЕПРАВИЛЬНО: Бизнес-логика в контроллере
async login(req: Request, res: Response): Promise<void> {
  const user = await db.query('SELECT * FROM users WHERE username = $1', [req.body.username]);
  const passwordMatch = await bcrypt.compare(req.body.password, user.password_hash);
  // ...
}
```

### 2. Services (Business Logic Layer)

Содержит всю бизнес-логику, валидацию правил, координацию между репозиториями.

```typescript
// ✅ ПРАВИЛЬНО: Сервис содержит бизнес-логику
export class PricingService {
  constructor(private priceRepository: PriceRepository) {}

  async calculateOptimalPrice(
    azsId: number,
    elasticity: number,
    competitorPrice: number
  ): Promise<number> {
    // Бизнес-логика: формула оптимальной цены
    const elasticityMagnitude = Math.abs(elasticity);
    const markup = (competitorPrice - costPrice) * 
                   (elasticityMagnitude / (elasticityMagnitude + 1));
    return Number((costPrice + markup).toFixed(2));
  }
}
```

### 3. Repositories (Data Access Layer)

Изолирует доступ к данным. Все SQL запросы здесь.

```typescript
// ✅ ПРАВИЛЬНО: Параметризованные запросы
export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    const result = await this.db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]  // ← Параметризованный запрос
    );
    return result.rows[0] || null;
  }
}

// ❌ НЕПРАВИЛЬНО: SQL injection vulnerability
async findByEmail(email: string): Promise<IUser | null> {
  const result = await this.db.query(
    `SELECT * FROM users WHERE email = '${email}'`  // ← ОПАСНО!
  );
}
```

### 4. Middleware (Cross-Cutting Concerns)

JWT верификация, RBAC, логирование, обработка ошибок.

```typescript
// ✅ ПРАВИЛЬНО: Middleware по отдельности
app.use(helmet());                              // Security
app.use(cors(corsOptions));                    // CORS
app.use(requestLogger);                        // Logging
app.use('/api/protected', authenticateToken);  // Auth
app.use('/api/admin', authorize('users_manage')); // RBAC
```

### 5. Models (Type Definitions)

TypeScript интерфейсы для всех сущностей. Никакие `any`!

```typescript
// ✅ ПРАВИЛЬНО: Полная типизация
interface IUser {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  role_id: number;
  created_at: Date;
  updated_at: Date;
}

// ❌ НЕПРАВИЛЬНО: Использование any
interface IUser {
  id: any;
  data: any;
}
```

## 🔐 Безопасность

### Authentication Flow

```
User → Login (username, password)
   ↓
AuthController validates input
   ↓
AuthService.login() {
  • Hash + compare password (bcryptjs, 12 rounds)
  • Generate JWT token (24h expiration)
  • Return token + user data
}
   ↓
Client stores token in localStorage/cookie
   ↓
Subsequent requests include JWT in Authorization header
```

### Authorization Flow

```
Request with JWT
   ↓
authenticateToken middleware {
  • Extract token from Authorization header
  • Verify JWT signature
  • Decode payload
  • Attach user info to req.user
}
   ↓
authorize(permission) middleware {
  • Check if user.role has required permission
  • Return 403 if not
}
   ↓
Controller executes business logic
```

### Security Best Practices

- ✅ **Passwords**: Bcryptjs с 12 salt rounds (не plain text)
- ✅ **SQL Injection**: Параметризованные запросы everywhere
- ✅ **XSS**: Vue автоматически экранирует, валидация на backend
- ✅ **CSRF**: CSRF tokens на изменяющих запросах
- ✅ **Secrets**: .env файлы, не в коде
- ✅ **HTTPS**: Обязателен в production
- ✅ **Helmet**: Security headers (Content-Security-Policy, etc)
- ✅ **CORS**: Strict origin whitelist

## 📊 Примеры паттернов

### Dependency Injection

```typescript
// ✅ Через конструктор (избегаем tight coupling)
class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async createUser(data: IRegisterRequest): Promise<IUser> {
    const user = await this.userRepository.create(data);
    await this.emailService.sendWelcomeEmail(user.email);
    this.logger.info(`User created: ${user.id}`);
    return user;
  }
}

// ❌ Hard-coded dependencies (тесты сложнее, переиспользование сложнее)
class UserService {
  private userRepository = new UserRepository();
  async createUser(data: any): Promise<any> { ... }
}
```

### Error Handling

```typescript
// ✅ ПРАВИЛЬНО: Структурированная обработка ошибок
try {
  const user = await this.userRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User', 'USER_NOT_FOUND');
  }
  return user;
} catch (error) {
  if (error instanceof AppError) {
    logger.warn(`Business error: ${error.code}`, 'UserService');
    throw error; // Let middleware handle it
  }
  logger.error('Unexpected error', error, 'UserService');
  throw new InternalServerError();
}
```

### Validation

```typescript
// ✅ ПРАВИЛЬНО: Joi schemas centralized
const loginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).required()
});

async login(credentials: any): Promise<ILoginResponse> {
  const validated = await validate(credentials, loginSchema);
  // validated is now ILoginRequest type-safe
  const token = this.generateToken(validated.username);
}
```

## 🧪 Тестирование

### Unit Tests

```typescript
// ✅ Тестируем сервис в изоляции
describe('PricingService', () => {
  let service: PricingService;
  let mockRepository: jest.Mocked<PriceRepository>;

  beforeEach(() => {
    mockRepository = jest.createMockFromModule('PriceRepository');
    service = new PricingService(mockRepository);
  });

  it('should calculate optimal price correctly', () => {
    const result = service.calculateOptimalPrice(50, -1.8, 54.5);
    expect(result).toBe(54.0);
  });
});
```

### Integration Tests

```typescript
// ✅ Тестируем полный flow с real DB
describe('Auth Endpoints', () => {
  it('POST /api/auth/login should return token', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Test123!' })
      .expect(200);

    expect(response.body).toHaveProperty('token');
    expect(response.body.token.token_type).toBe('Bearer');
  });
});
```

## 📈 Performance & Scalability

### Database Optimization

```typescript
// ✅ Indexed queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_azs_manager ON azs(manager_id);

// ✅ Connection pooling
const pool = new Pool({ max: 20, idleTimeoutMillis: 30000 });

// ✅ Query pagination
const users = await repository.findAll({ limit: 20, offset: 0 });
```

### Caching Strategy

```typescript
// ✅ Cache expensive queries
async getAzsDetails(azsId: number): Promise<IAzs> {
  const cached = await redis.get(`azs:${azsId}`);
  if (cached) return JSON.parse(cached);

  const azs = await this.repository.findById(azsId);
  await redis.setex(`azs:${azsId}`, 3600, JSON.stringify(azs));
  return azs;
}
```

## 📝 Type Safety

### No `any` - Ever!

```typescript
// ❌ ЗАПРЕЩЕНО
const data: any = await fetchData();
function process(user: any) { }

// ✅ ВСЕГДА типизируйте
const data: IUserData = await fetchData();
function process(user: IUser): void { }

// Если тип неизвестен, используйте unknown + type guard
const data: unknown = JSON.parse(raw);
if (typeof data === 'object' && data !== null && 'id' in data) {
  const id = (data as { id: number }).id;
}
```

## 🚀 Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Build stage
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN npm run build

# Runtime stage  
FROM node:20-alpine
WORKDIR /app
COPY --from=0 /app/dist ./dist
COPY --from=0 /app/node_modules ./node_modules

EXPOSE 3001
CMD ["node", "dist/server.js"]
```

### Environment Variables

```bash
# .env.example
NODE_ENV=production
PORT=3001

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=azs_admin
DB_PASSWORD=secure_password_32chars_minimum
DB_NAME=azs_pult

# Security
JWT_SECRET=your_secret_key_32chars_minimum
JWT_EXPIRES_IN=24h

# Redis
REDIS_URL=redis://redis:6379

# CORS
FRONTEND_URL=https://azs-pult.com

# Logging
LOG_LEVEL=info
```

## 📚 Документирование

### JSDoc примеры

```typescript
/**
 * Calculates optimal price based on elasticity model
 * 
 * @param costPrice - Product cost (₽/unit)
 * @param elasticity - Price elasticity of demand (negative value)
 * @param competitorPrice - Average competitor price (₽/unit)
 * @returns Optimal price that maximizes revenue
 * 
 * @example
 * const optimalPrice = calculateOptimalPrice(52, -1.8, 54.5);
 * // Returns 54.0
 * 
 * @throws {ValidationError} If inputs are invalid
 */
export function calculateOptimalPrice(
  costPrice: number,
  elasticity: number,
  competitorPrice: number
): number {
  // Implementation
}
```

---

**Версия**: 2.1.0  
**Обновлено**: 8 октября 2026  
**Статус**: Production Ready
