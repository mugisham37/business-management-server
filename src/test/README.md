# Testing Infrastructure

This directory contains the testing infrastructure for the NestJS ERP application, including helpers, factories, fixtures, and utilities for writing comprehensive tests.

## Directory Structure

```
test/
├── helpers/          # Test helper utilities
│   ├── auth.helper.ts           # Authentication and JWT utilities
│   ├── database.helper.ts       # Database cleanup and management
│   ├── mock.helper.ts           # Service mocking utilities
│   └── test-isolation.helper.ts # Test isolation setup
├── factories/        # Test data factories
│   ├── tenant.factory.ts        # Tenant entity factory
│   ├── user.factory.ts          # User entity factory
│   ├── role.factory.ts          # Role entity factory
│   └── permission.factory.ts    # Permission entity factory
├── fixtures/         # Common test scenarios
│   ├── auth.fixture.ts          # Complete auth setup
│   └── multi-tenant.fixture.ts  # Multi-tenant scenarios
├── setup.ts          # Global test setup
└── index.ts          # Main exports
```

## Quick Start

### Basic Test Setup

```typescript
import { PrismaClient } from '@prisma/client';
import { DatabaseHelper, createTestDatabaseConnection } from '@test/helpers';

describe('My Feature', () => {
  let prisma: PrismaClient;
  let dbHelper: DatabaseHelper;

  beforeAll(async () => {
    prisma = createTestDatabaseConnection();
  });

  beforeEach(async () => {
    dbHelper = new DatabaseHelper(prisma);
    await dbHelper.cleanDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should work', async () => {
    // Your test here
  });
});
```

### Using Factories

```typescript
import { createTenant, createUser } from '@test/factories';

it('should create entities', async () => {
  const tenant = await createTenant(prisma, {
    name: 'Test Company',
    slug: 'test-company',
  });

  const user = await createUser(prisma, tenant.id, {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
  });
});
```

### Using Fixtures

```typescript
import { createAuthFixture } from '@test/fixtures';

it('should use auth fixture', async () => {
  const fixture = await createAuthFixture(prisma);

  // Access pre-created entities
  const { tenant, admin, manager, user, viewer, roles, permissions, tokens } = fixture;

  // Use tokens for authenticated requests
  const response = await request(app)
    .get('/api/users')
    .set('Authorization', `Bearer ${tokens.admin.accessToken}`);
});
```

### Using Auth Helper

```typescript
import { AuthHelper } from '@test/helpers';

it('should generate tokens', () => {
  const authHelper = new AuthHelper();

  const tokens = authHelper.generateTokens({
    sub: 'user-id',
    email: 'test@example.com',
    tenantId: 'tenant-id',
    roles: ['admin'],
  });

  // Use tokens in requests
  const header = authHelper.createAuthHeader(tokens.accessToken);
});
```

### Using Mock Helpers

```typescript
import { createMockPrismaClient, createMockRedisClient } from '@test/helpers';

it('should use mocks', () => {
  const mockPrisma = createMockPrismaClient();
  const mockRedis = createMockRedisClient();

  mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@example.com' });
  mockRedis.get.mockResolvedValue('cached-value');
});
```

## Test Isolation

### Automatic Database Cleanup

```typescript
import { setupTestIsolation } from '@test/helpers';

describe('My Feature', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestDatabaseConnection();
  });

  // Automatically cleans database before each test
  setupTestIsolation(prisma);

  it('test 1', async () => {
    // Starts with clean database
  });

  it('test 2', async () => {
    // Also starts with clean database
  });
});
```

### Transaction Rollback (Alternative)

```typescript
import { setupTransactionIsolation } from '@test/helpers';

describe('My Feature', () => {
  let prisma: PrismaClient;
  let getPrisma: () => PrismaClient;

  beforeAll(() => {
    prisma = createTestDatabaseConnection();
  });

  // Each test runs in a transaction that is rolled back
  getPrisma = setupTransactionIsolation(prisma);

  it('test 1', async () => {
    const testPrisma = getPrisma();
    // Use testPrisma for operations
    // Transaction will be rolled back after test
  });
});
```

### Partial Cleanup

```typescript
import { setupPartialTestIsolation } from '@test/helpers';

describe('My Feature', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestDatabaseConnection();
  });

  // Only cleans specific tables
  setupPartialTestIsolation(prisma, ['users', 'tenants']);

  it('test', async () => {
    // Only users and tenants tables are cleaned
  });
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- my-feature.spec.ts

# Run tests with coverage
npm test:cov

# Run property-based tests
npm test:property

# Run tests in watch mode
npm test:watch
```

## Configuration

### Environment Variables

Test environment variables are configured in `.env.test`:

- `DATABASE_URL`: Test database connection string
- `JWT_SECRET`: JWT secret for token generation
- `BCRYPT_ROUNDS`: Low value (4) for faster password hashing in tests
- `LOG_LEVEL`: Set to 'error' to reduce noise

### Jest Configuration

Jest is configured in `jest.config.js` with:

- TypeScript support via ts-jest
- Path aliases (@test, @core, @shared, @api)
- Coverage thresholds (70% for all metrics)
- Serial test execution for database isolation
- 30-second timeout for property-based tests

## Best Practices

1. **Always clean database between tests** - Use `setupTestIsolation()` or manual cleanup
2. **Use factories for test data** - Don't create entities manually
3. **Use fixtures for complex scenarios** - Reuse common setups
4. **Mock external dependencies** - Use mock helpers for services
5. **Test isolation** - Each test should be independent
6. **Descriptive test names** - Use clear, descriptive test names
7. **Arrange-Act-Assert** - Follow AAA pattern in tests
8. **Don't test implementation details** - Test behavior, not internals

## Examples

See `infrastructure.spec.ts` for examples of using the testing infrastructure.

## Troubleshooting

### Database Connection Issues

If tests fail with database connection errors:

1. Ensure PostgreSQL is running
2. Verify `DATABASE_URL` in `.env.test` is correct
3. Run migrations: `npm run prisma:migrate`
4. Check database exists: `createdb erp_test_db`

### Slow Tests

If tests are slow:

1. Reduce `BCRYPT_ROUNDS` in `.env.test` (default: 4)
2. Use mocks instead of real database when possible
3. Use `setupPartialTestIsolation()` to clean only needed tables
4. Consider using transaction rollback instead of truncate

### Import Errors

If you get import errors:

1. Check path aliases in `jest.config.js`
2. Ensure `tsconfig.json` has correct paths
3. Restart Jest if using watch mode

## Contributing

When adding new test utilities:

1. Add to appropriate directory (helpers/factories/fixtures)
2. Export from index.ts
3. Add tests for the utility
4. Update this README with examples
