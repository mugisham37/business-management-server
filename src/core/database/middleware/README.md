# Prisma Middleware

This directory contains Prisma middleware that automatically applies cross-cutting concerns to database operations.

## Middleware Order

Middleware is applied in the following order (order matters):

1. **Timestamp Middleware** - Automatically sets `createdAt` and `updatedAt` timestamps
2. **Tenant Middleware** - Applies tenant isolation for multi-tenant operations
3. **Scope Filter Middleware** - Applies hierarchical scope filtering (branch/department)
4. **Soft Delete Middleware** - Implements soft delete functionality
5. **Audit Middleware** - Logs database operations for audit trail

## Scope Filter Middleware

### Overview

The scope filter middleware implements Layer 3 of the four-layer authorization system. It automatically filters database queries based on the user's hierarchical scope (branch and department).

### Requirements

Implements requirements 9.1-9.6 from the hierarchical authentication system:

- **9.1**: Extracts branchId and departmentId from user context
- **9.2**: Automatically adds WHERE clauses for MANAGER and WORKER users
- **9.3**: Bypasses filtering for OWNER users (organization-wide access)
- **9.4**: Applies to all Prisma queries through middleware
- **9.5**: Returns empty results for out-of-scope resources
- **9.6**: Prevents explicit scope override (except for OWNER)

### How It Works

1. **Context Extraction**: The middleware extracts user context from AsyncLocalStorage via `RequestContextService`
2. **Hierarchy Check**: If the user is an OWNER, no filtering is applied
3. **Operation Check**: Only applies to read operations (findMany, findFirst, findUnique, count, aggregate)
4. **Model Check**: Only applies to models with scope fields (users, staff_profiles, etc.)
5. **Filter Injection**: Automatically injects WHERE clauses filtering by branchId and departmentId

### Example

```typescript
// User context (set by RequestContextInterceptor)
const userContext = {
  userId: 'manager-123',
  hierarchyLevel: 'MANAGER',
  branchId: 'branch-123',
  departmentId: 'dept-123',
};

// Original query
await prisma.users.findMany({
  where: { status: 'ACTIVE' }
});

// Automatically transformed to:
await prisma.users.findMany({
  where: {
    AND: [
      { status: 'ACTIVE' },
      { branchId: 'branch-123', departmentId: 'dept-123' }
    ]
  }
});
```

### Scoped Models

The following models have scope filtering applied:

- `users` - User records
- `staff_profiles` - Staff profile records
- `permission_matrices` - Permission records
- `sessions` - Session records
- `audit_logs` - Audit log records

### Testing

See `scope-filter.middleware.spec.ts` for comprehensive test coverage including:

- Owner bypass (no filtering)
- Manager scope filtering (branch + department)
- Worker scope filtering (branch + department)
- No user context (no filtering)
- Non-read operations (no filtering)
- Non-scoped models (no filtering)

### Integration

The middleware is automatically registered in `PrismaService` and receives the `RequestContextService` instance:

```typescript
this.$use(scopeFilterMiddleware(this.requestContextService));
```

The `RequestContextInterceptor` is applied globally to all requests and sets the user context in AsyncLocalStorage before any database operations occur.
