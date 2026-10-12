# Developer Guide - АЗС-Пульт Backend

## How to Add a New Feature Module

This guide explains how to implement a new feature following the established architectural patterns. We'll use the hypothetical "Stations" (АЗС) module as an example.

## Step 1: Create the Model (Type Definitions)

Create `src/models/Azs.ts` with complete TypeScript type definitions:

```typescript
/**
 * Gas Station Model
 */

export interface IAzs {
  id: string;
  name: string;
  location_region: string;
  latitude: number | null;
  longitude: number | null;
  manager_id: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ICreateAzsRequest {
  name: string;
  location_region: string;
  latitude?: number;
  longitude?: number;
  manager_id?: string;
}

export interface IUpdateAzsRequest {
  name?: string;
  location_region?: string;
  latitude?: number;
  longitude?: number;
  is_active?: boolean;
}
```

## Step 2: Create Validation Schemas

Add to `src/utils/validators.ts`:

```typescript
export const azsValidators = {
  create: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    location_region: Joi.string().min(2).max(50).required(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    manager_id: Joi.string().uuid().optional()
  }),

  update: Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    location_region: Joi.string().min(2).max(50).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    is_active: Joi.boolean().optional()
  })
};
```

## Step 3: Create the Repository (Data Access)

Create `src/repositories/azs.repository.ts`:

```typescript
/**
 * AZS Repository - Data Access Layer
 * All database queries here, ALWAYS parameterized!
 */

import { Pool, QueryResult } from 'pg';
import { IAzs } from '@models/Azs';
import { logger } from '@utils/logger';

export class AzsRepository {
  constructor(private db: Pool) {}

  /**
   * Find AZS by ID
   */
  async findById(id: string): Promise<IAzs | null> {
    const query = 'SELECT * FROM azs WHERE id = $1';
    logger.query(query, [id]);
    
    const result: QueryResult<IAzs> = await this.db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get all AZS with pagination
   */
  async findAll(limit: number = 20, offset: number = 0): Promise<IAzs[]> {
    const query = `
      SELECT * FROM azs 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    logger.query(query, [limit, offset]);
    
    const result: QueryResult<IAzs> = await this.db.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Create new AZS
   */
  async create(data: Omit<IAzs, 'id'>): Promise<IAzs> {
    const query = `
      INSERT INTO azs (name, location_region, latitude, longitude, manager_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const values = [
      data.name,
      data.location_region,
      data.latitude,
      data.longitude,
      data.manager_id,
      data.is_active,
      data.created_at,
      data.updated_at
    ];
    
    logger.query(query, values);
    
    const result: QueryResult<IAzs> = await this.db.query(query, values);
    return result.rows[0];
  }

  /**
   * Update AZS
   */
  async update(id: string, updateData: Partial<Omit<IAzs, 'id' | 'created_at'>>): Promise<IAzs | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updateData.name);
    }

    if (updateData.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updateData.is_active);
    }

    // Always update updated_at
    fields.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    if (fields.length === 1) { // Only updated_at
      return this.findById(id);
    }

    values.push(id); // For WHERE clause

    const query = `UPDATE azs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    logger.query(query, values);
    
    const result: QueryResult<IAzs> = await this.db.query(query, values);
    return result.rows[0] || null;
  }

  /**
   * Delete AZS
   */
  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM azs WHERE id = $1';
    logger.query(query, [id]);
    
    const result = await this.db.query(query, [id]);
    return result.rowCount! > 0;
  }
}
```

**Key Points:**
- ✅ ALL queries are parameterized (prevent SQL injection)
- ✅ No business logic, only data access
- ✅ Queries are logged for debugging
- ✅ All methods return proper types
- ✅ Separate methods for single responsibility

## Step 4: Create the Service (Business Logic)

Create `src/services/azs.service.ts`:

```typescript
/**
 * AZS Service - Business Logic Layer
 */

import { AzsRepository } from '@repositories/azs.repository';
import { IAzs, ICreateAzsRequest, IUpdateAzsRequest } from '@models/Azs';
import { NotFoundError, ValidationError, ConflictError } from '@utils/errors';
import { logger } from '@utils/logger';

export class AzsService {
  constructor(private azsRepository: AzsRepository) {}

  /**
   * Create new AZS
   */
  async createAzs(data: ICreateAzsRequest): Promise<IAzs> {
    // Business logic: Validate manager exists if provided
    if (data.manager_id) {
      // TODO: Check if manager user exists and has manager role
    }

    const newAzs = await this.azsRepository.create({
      ...data,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    logger.info(`AZS created: ${newAzs.id}`, 'AzsService', { name: newAzs.name });

    return newAzs;
  }

  /**
   * Get AZS by ID
   */
  async getAzs(id: string): Promise<IAzs> {
    const azs = await this.azsRepository.findById(id);
    
    if (!azs) {
      throw new NotFoundError('AZS', 'AZS_NOT_FOUND');
    }

    return azs;
  }

  /**
   * Get all AZS with pagination
   */
  async listAzs(limit: number = 20, offset: number = 0): Promise<{ stations: IAzs[]; total: number }> {
    const stations = await this.azsRepository.findAll(limit, offset);
    
    // TODO: Get total count from repository

    return { stations, total: 0 };
  }

  /**
   * Update AZS
   */
  async updateAzs(id: string, updateData: IUpdateAzsRequest): Promise<IAzs> {
    // Validate AZS exists first
    const existingAzs = await this.azsRepository.findById(id);
    if (!existingAzs) {
      throw new NotFoundError('AZS', 'AZS_NOT_FOUND');
    }

    const updated = await this.azsRepository.update(id, {
      ...updateData,
      updated_at: new Date()
    });

    if (!updated) {
      throw new Error('Failed to update AZS');
    }

    logger.info(`AZS updated: ${id}`, 'AzsService');

    return updated;
  }

  /**
   * Delete AZS
   */
  async deleteAzs(id: string): Promise<void> {
    // Validate AZS exists
    const azs = await this.azsRepository.findById(id);
    if (!azs) {
      throw new NotFoundError('AZS', 'AZS_NOT_FOUND');
    }

    // Business logic: Check if AZS has associated data
    // If yes, either cascade or prevent deletion

    const deleted = await this.azsRepository.delete(id);
    
    if (!deleted) {
      throw new Error('Failed to delete AZS');
    }

    logger.info(`AZS deleted: ${id}`, 'AzsService');
  }
}
```

**Key Points:**
- ✅ ALL business logic here (validation, rules, etc.)
- ✅ Calls repository methods
- ✅ Throws custom errors
- ✅ Logs important operations
- ✅ No HTTP concerns

## Step 5: Create the Controller (HTTP Handler)

Create `src/controllers/azs.controller.ts`:

```typescript
/**
 * AZS Controller - HTTP Request Handler
 * ✅ No business logic here
 * ✅ Only validates input, calls service, returns response
 */

import { Request, Response } from 'express';
import { AzsService } from '@services/azs.service';
import { validate, azsValidators, paginationValidators } from '@utils/validators';
import { ICreateAzsRequest, IUpdateAzsRequest } from '@models/Azs';
import { logger } from '@utils/logger';

export class AzsController {
  constructor(private azsService: AzsService) {}

  /**
   * POST /api/azs
   * Create new AZS
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const validated = await validate<ICreateAzsRequest>(req.body, azsValidators.create);
      
      logger.info('Creating AZS', 'AzsController', { name: validated.name });
      
      const result = await this.azsService.createAzs(validated);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/azs/:id
   * Get AZS details
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const result = await this.azsService.getAzs(id);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * GET /api/azs
   * List all AZS
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      const validated = await validate<{ limit: number; offset: number }>(
        req.query,
        paginationValidators.query
      );
      
      const result = await this.azsService.listAzs(validated.limit, validated.offset);
      
      res.status(200).json({
        success: true,
        data: result.stations,
        pagination: {
          limit: validated.limit,
          offset: validated.offset,
          total: result.total
        }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * PUT /api/azs/:id
   * Update AZS
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validated = await validate<IUpdateAzsRequest>(req.body, azsValidators.update);
      
      const result = await this.azsService.updateAzs(id, validated);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * DELETE /api/azs/:id
   * Delete AZS
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      await this.azsService.deleteAzs(id);
      
      res.status(200).json({
        success: true,
        message: 'AZS deleted successfully'
      });
    } catch (error) {
      throw error;
    }
  }
}
```

**Key Points:**
- ✅ No business logic
- ✅ Only HTTP concerns (status codes, response format)
- ✅ Validates input
- ✅ Calls service method
- ✅ Returns formatted response

## Step 6: Register Routes in server.ts

Add to `src/server.ts`:

```typescript
// Initialize services and controllers
const azsRepository = new AzsRepository(db);
const azsService = new AzsService(azsRepository);
const azsController = new AzsController(azsService);

// Routes
app.post('/api/azs', authenticateToken, authorize('azs_create'), asyncHandler(
  (req, res) => azsController.create(req, res)
));

app.get('/api/azs', authenticateToken, authorize('azs_list'), asyncHandler(
  (req, res) => azsController.list(req, res)
));

app.get('/api/azs/:id', authenticateToken, authorize('azs_view'), asyncHandler(
  (req, res) => azsController.getById(req, res)
));

app.put('/api/azs/:id', authenticateToken, authorize('azs_update'), asyncHandler(
  (req, res) => azsController.update(req, res)
));

app.delete('/api/azs/:id', authenticateToken, authorize('azs_delete'), asyncHandler(
  (req, res) => azsController.delete(req, res)
));
```

## Step 7: Write Tests

Create `tests/unit/services/azs.service.test.ts`:

```typescript
/**
 * AZS Service Unit Tests
 */

import { AzsService } from '@services/azs.service';
import { AzsRepository } from '@repositories/azs.repository';
import { NotFoundError } from '@utils/errors';
import { IAzs } from '@models/Azs';

const mockAzsRepository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn()
};

describe('AzsService', () => {
  let service: AzsService;
  const mockAzs: IAzs = {
    id: 'azs-123',
    name: 'Station 1',
    location_region: 'Tver region',
    latitude: 55.7558,
    longitude: 37.6173,
    manager_id: 'user-456',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AzsService(mockAzsRepository as unknown as AzsRepository);
  });

  describe('getAzs', () => {
    it('should return AZS if found', async () => {
      mockAzsRepository.findById.mockResolvedValue(mockAzs);

      const result = await service.getAzs('azs-123');

      expect(result).toEqual(mockAzs);
      expect(mockAzsRepository.findById).toHaveBeenCalledWith('azs-123');
    });

    it('should throw NotFoundError if AZS not found', async () => {
      mockAzsRepository.findById.mockResolvedValue(null);

      await expect(service.getAzs('nonexistent'))
        .rejects
        .toThrow(NotFoundError);
    });
  });

  describe('createAzs', () => {
    it('should create new AZS', async () => {
      mockAzsRepository.create.mockResolvedValue(mockAzs);

      const result = await service.createAzs({
        name: 'Station 1',
        location_region: 'Tver region'
      });

      expect(result).toEqual(mockAzs);
      expect(mockAzsRepository.create).toHaveBeenCalled();
    });
  });

  // ... more tests
});
```

Create `tests/integration/azs.integration.test.ts`:

```typescript
/**
 * AZS Integration Tests
 */

import request from 'supertest';
import { createApp } from '@/server';

describe('AZS Endpoints', () => {
  let app;
  let token: string;

  beforeAll(() => {
    app = createApp();
    // Get token from login
  });

  describe('POST /api/azs', () => {
    it('should create new AZS', async () => {
      const response = await request(app)
        .post('/api/azs')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Station',
          location_region: 'Tver region'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Test Station');
    });
  });

  // ... more tests
});
```

## Best Practices Checklist

- ✅ **Models First** - Define types before implementation
- ✅ **Validation Schemas** - Add to validators.ts
- ✅ **Repository Pattern** - All DB queries parameterized
- ✅ **Service Layer** - Business logic only
- ✅ **Controller Layer** - HTTP handling only
- ✅ **Error Handling** - Use custom errors
- ✅ **Logging** - Log important operations
- ✅ **Type Safety** - No `any` types
- ✅ **Testing** - Unit + integration tests
- ✅ **RBAC** - Add permissions to rbac.middleware.ts

## Common Patterns

### Pagination
```typescript
// In repository
async findAll(limit: number, offset: number): Promise<Entity[]> {
  // ...
}

// In controller
const { limit, offset } = await validate(req.query, paginationValidators.query);
const results = await service.list(limit, offset);
```

### Error Handling
```typescript
try {
  // Do something
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NotFoundError) {
    // Handle not found
  }
  throw error; // Let error handler middleware handle it
}
```

### Logging
```typescript
logger.info('Operation completed', 'ModuleName', { data });
logger.warn('Something unusual', 'ModuleName');
logger.error('Error occurred', error, 'ModuleName');
logger.query(query, params);
```

### RBAC
```typescript
// In rbac.middleware.ts, add permission
const permissionMap: Record<string, RoleId[]> = {
  'feature_action': [RoleId.ADMIN, RoleId.MANAGER]
};

// In routes
router.post('/api/feature', authorize('feature_action'), controller.method);
```

## Debugging

```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev

# Database queries will be logged
# Auth attempts will be logged
# All operations will be visible
```

## Performance Tips

- Use connection pooling (already configured)
- Add database indexes on frequently queried columns
- Implement Redis caching for expensive operations
- Paginate large result sets
- Use lean queries when you don't need all fields

## Security Checklist

- ✅ Parameterized queries (prevent SQL injection)
- ✅ Input validation with Joi
- ✅ Authentication middleware on protected routes
- ✅ Authorization checks with RBAC
- ✅ Error messages don't leak info
- ✅ Logging for audit trail

---

**Remember:** Follow the pattern established in the Auth module. It's the reference implementation.
