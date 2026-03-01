# HIERARCHICAL AUTHENTICATION & AUTHORIZATION SYSTEM - IMPLEMENTATION PROMPT

## PROJECT CONTEXT

You are building a comprehensive authentication and authorization system for an ERP Business Management platform using NestJS, GraphQL, gRPC, Prisma, and PostgreSQL. This system implements a hierarchical permission delegation model inspired by ERPNext but modernized for microservices architecture.

### Current Foundation
- NestJS backend with GraphQL (Apollo) and gRPC APIs
- PostgreSQL database with Prisma ORM
- Redis for caching and session management
- JWT-based authentication infrastructure (basic implementation exists)
- Multi-tenant architecture foundation
- Existing modules: Auth, User, Organization, Permission services

### Technology Stack Requirements
- NestJS with TypeScript
- GraphQL with Apollo Server for client-facing APIs
- gRPC for inter-service communication
- Prisma for database ORM
- PostgreSQL for data persistence
- Redis for caching and token blacklisting
- JWT for authentication tokens
- bcrypt for password hashing
- Passport.js for authentication strategies
- Google OAuth for organization owner signup only

## CORE ARCHITECTURAL PRINCIPLES

### 1. BLANK SLATE BY DEFAULT
When an organization is created, NO hierarchy exists except the Owner. No roles are pre-assigned. No structure is assumed. The Owner builds the organizational tree node by node as the business grows.

### 2. DELEGATED PERMISSION INHERITANCE
Every person receives access from someone above them. That person can ONLY share permissions they themselves possess. This is the GOLDEN RULE enforced at every layer.

**THE GOLDEN RULE:**
```
A person's maximum grantable permissions = the exact set of permissions they hold
You CANNOT give what you do NOT have
You CAN give any subset of what you DO have
```

### 3. IDENTITY IS CONTEXTUAL
A user is not just credentials. They are:
- A person (User Record)
- In a role (hierarchy level: OWNER/MANAGER/WORKER)
- Inside a department or branch (organizational unit)
- Inside an organization (tenant)
- With specific permissions (module:action matrix)

Every JWT token, every query, every permission check carries this FULL context.

## SYSTEM ARCHITECTURE OVERVIEW

### Service Layer Architecture
```
CLIENT (Web/Mobile/POS)
    ↓ GraphQL over HTTPS (JWT Bearer Token)
API GATEWAY (NestJS GraphQL Federation)
    ├─ JWT Validation Guards
    ├─ Identity Injection into Context
    ├─ Request Routing
    ├─ Rate Limiting
    └─ Audit Log Emission
    ↓ gRPC Internal Communication
┌────────────┬────────────┬──────────────────┬───────────────────┐
AUTH         USER         ORGANIZATION       PERMISSION
SERVICE      SERVICE      SERVICE            SERVICE
├─Login      ├─Profiles   ├─Org records      ├─Permission matrix
├─Token      ├─Hierarchy  ├─Branches         ├─Delegation rules
├─Refresh    ├─PIN/PWD    ├─Departments      ├─Access check API
├─Revoke     └─Staff      └─Settings         └─Cascade revocation
└─2FA/OAuth
    ↓
POSTGRESQL DATABASE (per-organization schema isolation)
├─ organizations  ├─ users           ├─ permissions_matrix
├─ branches       ├─ sessions        ├─ audit_logs
├─ departments    ├─ refresh_tokens  └─ authorization_rules
```

### Database Schema Requirements

You MUST design and implement the following database schema using Prisma:

#### Core Entities

**Organization**
- id (UUID, primary key)
- name (string, required)
- type (enum: SOLE_PROPRIETORSHIP, RETAIL, WHOLESALE, MANUFACTURING)
- owner_id (UUID, foreign key to User, required, unique)
- registered_email (string, required, unique)
- status (enum: ACTIVE, SUSPENDED, CLOSED)
- settings (JSON, for org-specific configuration)
- created_at, updated_at, deleted_at (timestamps)

**User** (Authentication Identity)
- id (UUID, primary key)
- email (string, unique, nullable for PIN-only users)
- password_hash (string, nullable)
- pin_hash (string, nullable for workers)
- google_id (string, nullable, unique - for OAuth)
- organization_id (UUID, foreign key, required)
- hierarchy_level (enum: OWNER, MANAGER, WORKER)
- created_by_id (UUID, foreign key to User, nullable - null for Owner)
- branch_id (UUID, foreign key, nullable)
- department_id (UUID, foreign key, nullable)
- status (enum: ACTIVE, DISABLED, SUSPENDED, LEFT)
- last_login_at (timestamp, nullable)
- created_at, updated_at, deleted_at (timestamps)
- Indexes: organization_id, email, status, hierarchy_level, created_by_id

**StaffProfile** (Organizational Identity)
- id (UUID, primary key)
- user_id (UUID, foreign key to User, unique, required)
- full_name (string, required)
- position_title (string, required)
- employee_code (string, unique per organization)
- contact_number (string, nullable)
- emergency_contact (string, nullable)
- date_of_joining (date, required)
- date_of_leaving (date, nullable)
- reports_to_user_id (UUID, foreign key to User, nullable)
- employment_status (enum: ACTIVE, ON_LEAVE, SUSPENDED, TERMINATED, RESIGNED)
- created_at, updated_at (timestamps)

**Branch**
- id (UUID, primary key)
- organization_id (UUID, foreign key, required)
- name (string, required)
- code (string, unique per organization)
- address (text, nullable)
- is_active (boolean, default true)
- created_by_id (UUID, foreign key to User)
- created_at, updated_at, deleted_at (timestamps)

**Department**
- id (UUID, primary key)
- organization_id (UUID, foreign key, required)
- branch_id (UUID, foreign key, nullable - can be org-wide)
- name (string, required)
- code (string, unique per organization)
- description (text, nullable)
- is_active (boolean, default true)
- created_by_id (UUID, foreign key to User)
- created_at, updated_at, deleted_at (timestamps)

**PermissionMatrix**
- id (UUID, primary key)
- user_id (UUID, foreign key to User, required)
- organization_id (UUID, foreign key, required)
- module (string, required - e.g., "INVENTORY", "SALES")
- actions (JSON array - e.g., ["VIEW", "CREATE", "EDIT"])
- granted_by_id (UUID, foreign key to User, required)
- granted_at (timestamp, required)
- revoked_at (timestamp, nullable)
- is_active (boolean, default true)
- Unique constraint: (user_id, module, is_active)
- Indexes: user_id, organization_id, module

**PermissionSnapshot**
- id (UUID, primary key)
- user_id (UUID, foreign key to User, required)
- snapshot_data (JSON - full permission matrix at point in time)
- fingerprint_hash (string - SHA256 hash of permissions)
- created_at (timestamp, required)
- reason (enum: TOKEN_ISSUE, TRANSACTION_SUBMIT, AUDIT_CHECKPOINT)
- Indexes: user_id, fingerprint_hash, created_at

**AuthorizationRule** (Business Rules Engine)
- id (UUID, primary key)
- organization_id (UUID, foreign key, required)
- branch_id (UUID, foreign key, nullable - null means org-wide)
- rule_name (string, required)
- transaction_type (string, required - e.g., "SALES_ORDER", "PURCHASE_ORDER")
- based_on (string, required - e.g., "GRAND_TOTAL", "DISCOUNT_PERCENT")
- threshold_value (decimal, required)
- applies_to_level (enum: OWNER, MANAGER, WORKER, ALL, nullable)
- applies_to_user_id (UUID, foreign key to User, nullable)
- approver_level (enum: OWNER, MANAGER, nullable)
- approver_user_id (UUID, foreign key to User, nullable)
- priority (integer, default 100)
- is_active (boolean, default true)
- created_by_id (UUID, foreign key to User)
- created_at, updated_at (timestamps)
- Indexes: organization_id, transaction_type, is_active, priority

**Session**
- id (UUID, primary key)
- user_id (UUID, foreign key to User, required)
- refresh_token_hash (string, required, unique)
- access_token_fingerprint (string, required)
- ip_address (string, nullable)
- user_agent (string, nullable)
- expires_at (timestamp, required)
- revoked_at (timestamp, nullable)
- created_at (timestamp, required)
- Indexes: user_id, refresh_token_hash, expires_at

**AuditLog**
- id (UUID, primary key)
- organization_id (UUID, foreign key, required)
- user_id (UUID, foreign key to User, nullable)
- hierarchy_level (enum, nullable)
- action (enum: CREATE, READ, UPDATE, DELETE, SUBMIT, APPROVE, DENY, LOGIN, LOGOUT, PERMISSION_GRANT, PERMISSION_REVOKE)
- resource_type (string, required - module/entity name)
- resource_id (string, nullable)
- result (enum: SUCCESS, DENIED, ERROR)
- ip_address (string, nullable)
- metadata (JSON - before/after state, denial reason, etc.)
- created_at (timestamp, required)
- Indexes: organization_id, user_id, action, resource_type, created_at, result

## IMPLEMENTATION PHASES

### PHASE 1: DATABASE SCHEMA & MIGRATIONS

**Task 1.1: Design Complete Prisma Schema**

Create a comprehensive Prisma schema file that includes:
- All entities listed above with proper relationships
- Proper indexes for query performance
- Cascade delete rules where appropriate
- Unique constraints for business rules
- Enums for all status and type fields
- JSON fields for flexible metadata storage

**Task 1.2: Create Initial Migration**
Generate and apply the initial Prisma migration:
```bash
npx prisma migrate dev --name initial_auth_hierarchy_schema
```

**Task 1.3: Seed Data Structure**
Create seed files for:
- Module definitions (INVENTORY, SALES, PURCHASING, HR_PAYROLL, FINANCE, POS, REPORTS, SETTINGS, MANUFACTURING)
- Action definitions per module (VIEW, CREATE, EDIT, DELETE, SUBMIT, APPROVE, MANAGE, EXPORT, etc.)
- Default organization types with module availability matrix

### PHASE 2: AUTHENTICATION SERVICE IMPLEMENTATION

**Task 2.1: Organization Registration Flow**

Implement the first signup flow that creates BOTH Organization and Owner simultaneously:

**GraphQL Mutation:**
```graphql
mutation RegisterOrganization($input: RegisterOrganizationInput!) {
  registerOrganization(input: $input) {
    organization {
      id
      name
      type
      registeredEmail
    }
    owner {
      id
      email
      fullName
    }
    tokens {
      accessToken
      refreshToken
      expiresIn
    }
  }
}
```

**Input Type:**
```typescript
interface RegisterOrganizationInput {
  organizationName: string;
  organizationType: OrganizationType;
  ownerEmail: string;
  ownerFullName: string;
  ownerPassword?: string; // Optional if using Google OAuth
  googleIdToken?: string; // For Google OAuth signup
}
```

**Implementation Requirements:**
1. Validate organization name uniqueness
2. Validate email uniqueness across ALL organizations
3. If googleIdToken provided:
   - Verify token with Google OAuth API
   - Extract email and name from Google profile
   - Store google_id in User record
4. If password provided:
   - Validate password strength (min 8 chars, uppercase, lowercase, number, special char)
   - Hash password with bcrypt (12 rounds)
5. Create Organization record
6. Create User record with hierarchy_level = OWNER
7. Create StaffProfile record linked to User
8. Create FULL PermissionMatrix for Owner (all modules, all actions)
9. Create PermissionSnapshot with reason = TOKEN_ISSUE
10. Generate JWT tokens with full context
11. Create Session record
12. Emit AuditLog entry (action = CREATE, resource_type = ORGANIZATION)
13. Return organization, owner, and tokens

**All operations MUST be in a single database transaction. If any step fails, rollback everything.**

**Task 2.2: Login Flow (Email/Password)**

Implement standard login for all user types:

**GraphQL Mutation:**
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    user {
      id
      email
      fullName
      hierarchyLevel
      organization {
        id
        name
      }
      branch {
        id
        name
      }
      department {
        id
        name
      }
    }
    tokens {
      accessToken
      refreshToken
      expiresIn
    }
  }
}
```

**Implementation Requirements:**
1. Find user by email where status = ACTIVE and deletedAt is null
2. Verify organization is ACTIVE
3. Verify password hash using bcrypt
4. Fetch user's complete permission matrix from PermissionMatrix table
5. Fetch user's branch and department information
6. Fetch user's StaffProfile
7. Generate JWT access token (15 minutes expiry) with payload:
   - sub: user_id
   - email: user email
   - organizationId: organization_id
   - hierarchyLevel: OWNER/MANAGER/WORKER
   - branchId: branch_id (if assigned)
   - departmentId: department_id (if assigned)
   - createdBy: created_by_id
   - permissionFingerprint: SHA256 hash of permission matrix
   - iat: issued at timestamp
   - exp: expiration timestamp
8. Generate refresh token (7 days expiry)
9. Create PermissionSnapshot with reason = TOKEN_ISSUE
10. Create Session record with refresh token hash
11. Update user.last_login_at
12. Emit AuditLog entry (action = LOGIN, result = SUCCESS)
13. Return user data and tokens

**On failure:**
- Emit AuditLog entry (action = LOGIN, result = DENIED, metadata = reason)
- Throw UnauthorizedException with generic message

**Task 2.3: PIN Login Flow (Workers)**

Implement PIN-based login for workers on shared terminals:

**GraphQL Mutation:**
```graphql
mutation LoginWithPIN($pin: String!, $organizationId: ID!) {
  loginWithPIN(pin: $pin, organizationId: $organizationId) {
    user {
      id
      fullName
      hierarchyLevel
      positionTitle
    }
    tokens {
      accessToken
      refreshToken
      expiresIn
    }
  }
}
```

**Implementation Requirements:**
1. Find user by pin_hash where organization_id matches and status = ACTIVE
2. Verify PIN hash using bcrypt
3. Follow same token generation flow as email login
4. PINs are 4-6 digits, hashed with bcrypt before storage
5. PIN must be unique within an organization
6. Emit AuditLog entry with action = LOGIN

**Task 2.4: Token Refresh Flow**

Implement token refresh mechanism:

**GraphQL Mutation:**
```graphql
mutation RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    accessToken
    refreshToken
    expiresIn
  }
}
```

**Implementation Requirements:**
1. Verify refresh token signature and expiration
2. Check if token is in Redis blacklist (key: `blacklist:refresh:{token_hash}`)
3. Find Session record by refresh_token_hash
4. Verify session is not revoked (revoked_at is null)
5. Verify session has not expired
6. Fetch user's CURRENT permission matrix (permissions may have changed)
7. Generate new access token with fresh permission fingerprint
8. Optionally rotate refresh token (sliding expiry pattern)
9. Update Session record with new tokens
10. Create new PermissionSnapshot
11. Return new tokens

**Task 2.5: Logout & Token Revocation**

Implement logout and token revocation:

**GraphQL Mutation:**
```graphql
mutation Logout {
  logout {
    success
    message
  }
}
```

**Implementation Requirements:**
1. Extract refresh token from request context
2. Add refresh token to Redis blacklist with TTL = remaining token lifetime
3. Update Session record: set revoked_at = now
4. Emit AuditLog entry (action = LOGOUT)
5. Return success response

**Task 2.6: JWT Validation Guard**

Implement NestJS Guard for JWT validation on every GraphQL request:

**Guard Requirements:**
1. Extract JWT from Authorization header (Bearer token)
2. Verify token signature using JWT secret
3. Check token expiration
4. Extract payload and validate required fields
5. Check if user still exists and is ACTIVE
6. Check if organization is ACTIVE
7. Inject user context into GraphQL context:
   ```typescript
   interface RequestContext {
     user: {
       id: string;
       email: string;
       organizationId: string;
       hierarchyLevel: HierarchyLevel;
       branchId?: string;
       departmentId?: string;
       createdBy?: string;
       permissionFingerprint: string;
     }
   }
   ```
8. On validation failure, throw UnauthorizedException
9. Emit AuditLog entry for failed authentication attempts

### PHASE 3: AUTHORIZATION & PERMISSION SERVICE

**Task 3.1: Permission Matrix Service**

Create a dedicated PermissionService with gRPC interface for inter-service communication:

**gRPC Service Definition (proto/services/permission.proto):**
```protobuf
service PermissionService {
  rpc CheckPermission(CheckPermissionRequest) returns (CheckPermissionResponse);
  rpc GetUserPermissions(GetUserPermissionsRequest) returns (GetUserPermissionsResponse);
  rpc GrantPermissions(GrantPermissionsRequest) returns (GrantPermissionsResponse);
  rpc RevokePermissions(RevokePermissionsRequest) returns (RevokePermissionsResponse);
  rpc ValidateDelegation(ValidateDelegationRequest) returns (ValidateDelegationResponse);
}
```

**Service Methods:**

**checkPermission(userId, module, action)**
- Query PermissionMatrix for user
- Check if user has module:action permission
- Return boolean + permission details
- Cache result in Redis (TTL: 5 minutes)
- Key: `perm:${userId}:${module}:${action}`

**getUserPermissions(userId)**
- Fetch all active permissions for user from PermissionMatrix
- Return structured permission map:
  ```typescript
  {
    [module: string]: {
      actions: string[];
      grantedBy: string;
      grantedAt: Date;
    }
  }
  ```
- Cache in Redis (TTL: 5 minutes)
- Key: `perm:user:${userId}`

**grantPermissions(granterId, granteeId, permissions[])**
- CRITICAL: Validate delegation rules (THE GOLDEN RULE)
- Fetch granter's permission matrix
- For each requested permission:
  - Check if granter has the module
  - Check if granter has the specific action
  - If granter lacks ANY requested permission, REJECT entire request
- If validation passes:
  - Create PermissionMatrix records for grantee
  - Set granted_by_id = granterId
  - Invalidate grantee's permission cache
  - Emit AuditLog entry (action = PERMISSION_GRANT)
  - Return success
- If validation fails:
  - Emit AuditLog entry (action = PERMISSION_GRANT, result = DENIED)
  - Return error with specific permissions that failed validation

**revokePermissions(revokerId, targetUserId, permissions[])**
- Verify revoker has authority (must be creator or superior in hierarchy)
- Mark PermissionMatrix records as revoked (set revoked_at, is_active = false)
- Trigger cascade revocation:
  - Find all users created by targetUserId
  - For each subordinate, check if they have any of the revoked permissions
  - Recursively revoke those permissions from subordinates
  - Continue cascade down the hierarchy tree
- Invalidate all affected users' permission caches
- Emit AuditLog entries for all revocations
- Return list of affected users

**validateDelegation(granterId, requestedPermissions[])**
- Fetch granter's permission matrix
- Compare requested permissions against granter's permissions
- Return validation result:
  ```typescript
  {
    isValid: boolean;
    validPermissions: Permission[];
    invalidPermissions: Permission[];
    missingPermissions: Permission[];
  }
  ```
- Used by UI to show/hide permission checkboxes

**Task 3.2: Four-Layer Authorization System**

Implement the four-layer authorization check as NestJS Guards and Decorators:

**Layer 1: Hierarchy Level Guard**

Create `@RequireLevel()` decorator and `HierarchyLevelGuard`:

```typescript
@RequireLevel(HierarchyLevel.OWNER)
@Mutation(() => Organization)
async updateOrganizationSettings() { }
```

**Guard Logic:**
1. Extract user context from request
2. Check if user.hierarchyLevel meets required level
3. Level hierarchy: OWNER > MANAGER > WORKER
4. If check fails, throw ForbiddenException
5. Emit AuditLog entry (action = attempted action, result = DENIED, metadata = "Insufficient hierarchy level")

**Layer 2: Permission Guard**

Create `@RequirePermission()` decorator and `PermissionGuard`:

```typescript
@RequirePermission('INVENTORY', 'CREATE')
@Mutation(() => InventoryItem)
async createInventoryItem() { }
```

**Guard Logic:**
1. Extract user context from request
2. Call PermissionService.checkPermission(userId, module, action) via gRPC
3. If permission denied, throw ForbiddenException
4. Emit AuditLog entry (result = DENIED, metadata = "Missing permission: module:action")

**Layer 3: Scope Guard**

Create `@RequireScope()` decorator and `ScopeGuard`:

```typescript
@RequireScope('BRANCH')
@Query(() => [SalesOrder])
async getSalesOrders() { }
```

**Guard Logic:**
1. Extract user context from request
2. Extract resource identifiers from query/mutation arguments
3. If user is OWNER: allow access to all scopes
4. If user is MANAGER/WORKER:
   - Verify resource.branchId matches user.branchId (if branch-scoped)
   - Verify resource.departmentId matches user.departmentId (if department-scoped)
   - Verify resource.organizationId matches user.organizationId (always)
5. If scope check fails, throw ForbiddenException
6. Emit AuditLog entry (result = DENIED, metadata = "Scope violation")

**Automatic Scope Filtering:**

Create Prisma middleware to automatically append scope filters to ALL queries:

```typescript
prisma.$use(async (params, next) => {
  const userContext = getCurrentUserContext(); // From AsyncLocalStorage
  
  if (!userContext || userContext.hierarchyLevel === 'OWNER') {
    return next(params);
  }
  
  // Append scope filters
  if (params.action === 'findMany' || params.action === 'findFirst') {
    params.args.where = {
      ...params.args.where,
      organizationId: userContext.organizationId,
      ...(userContext.branchId && { branchId: userContext.branchId }),
    };
  }
  
  return next(params);
});
```

**Layer 4: Business Authorization Rules Guard**

Create `@CheckAuthorizationRules()` decorator and `AuthorizationRulesGuard`:

```typescript
@CheckAuthorizationRules('SALES_ORDER')
@Mutation(() => SalesOrder)
async submitSalesOrder() { }
```

**Guard Logic:**
1. Extract transaction data from mutation arguments
2. Query AuthorizationRule table for applicable rules:
   - Match transaction_type
   - Match organization_id
   - Match branch_id (or null for org-wide rules)
   - Filter by is_active = true
   - Order by priority ASC
3. Evaluate rules in priority order:
   - Check if rule applies to current user (by user_id or hierarchy_level)
   - Extract threshold value from transaction (based on rule.based_on field)
   - Compare transaction value against rule.threshold_value
4. If threshold exceeded:
   - Check if current user is listed as approver
   - If not, throw ForbiddenException with approver information
   - Emit AuditLog entry (result = DENIED, metadata = "Requires approval from: [approver names]")
5. If within threshold or user is approver, allow action

**Task 3.3: Permission Cascade Revocation Engine**

Implement recursive permission revocation:

**Algorithm:**
```typescript
async cascadeRevokePermissions(
  userId: string,
  revokedPermissions: Permission[],
  revokedBy: string,
  affectedUsers: string[] = []
): Promise<string[]> {
  // Find all users created by this user
  const subordinates = await prisma.user.findMany({
    where: { createdById: userId, status: 'ACTIVE' }
  });
  
  for (const subordinate of subordinates) {
    // Get subordinate's current permissions
    const subordinatePerms = await getPermissionMatrix(subordinate.id);
    
    // Find intersection of revoked permissions and subordinate's permissions
    const toRevoke = findIntersection(revokedPermissions, subordinatePerms);
    
    if (toRevoke.length > 0) {
      // Revoke permissions from subordinate
      await revokePermissionsFromUser(subordinate.id, toRevoke, revokedBy);
      
      // Add to affected users list
      affectedUsers.push(subordinate.id);
      
      // Recursively cascade to subordinate's subordinates
      await cascadeRevokePermissions(
        subordinate.id,
        toRevoke,
        revokedBy,
        affectedUsers
      );
    }
  }
  
  return affectedUsers;
}
```

**Requirements:**
- Must be executed in a database transaction
- Must invalidate Redis cache for all affected users
- Must emit AuditLog entry for each revocation
- Must handle circular references (should not exist, but guard against infinite loops)
- Must complete within 30 seconds or rollback

### PHASE 4: USER MANAGEMENT & HIERARCHY BUILDING

**Task 4.1: Create Manager Flow**

Implement Owner/Manager creating a new Manager:

**GraphQL Mutation:**
```graphql
mutation CreateManager($input: CreateManagerInput!) {
  createManager(input: $input) {
    user {
      id
      email
      fullName
      hierarchyLevel
    }
    staffProfile {
      id
      positionTitle
      employeeCode
    }
    permissions {
      module
      actions
    }
  }
}
```

**Input Type:**
```typescript
interface CreateManagerInput {
  email: string;
  password?: string;
  fullName: string;
  positionTitle: string;
  branchId?: string;
  departmentId?: string;
  permissions: {
    module: string;
    actions: string[];
  }[];
  sendInvitationEmail: boolean;
}
```

**Implementation Requirements:**
1. Verify creator has permission to create managers (check hierarchy level and permissions)
2. Validate email uniqueness across organization
3. Validate all requested permissions against creator's permission matrix using PermissionService.validateDelegation()
4. If validation fails, return error with specific invalid permissions
5. Hash password with bcrypt
6. Create User record:
   - hierarchy_level = MANAGER
   - created_by_id = creator's user_id
   - organization_id = creator's organization_id
   - branch_id, department_id from input
   - status = ACTIVE
7. Create StaffProfile record:
   - Generate unique employee_code
   - Set reports_to_user_id = creator's user_id
   - employment_status = ACTIVE
8. Create PermissionMatrix records for each granted permission
9. Create PermissionSnapshot
10. If sendInvitationEmail = true:
    - Generate temporary login token (24 hour expiry)
    - Send email with setup link
11. Emit AuditLog entry (action = CREATE, resource_type = USER)
12. Return created user, staff profile, and permissions

**All operations in single transaction.**

**Task 4.2: Create Worker Flow**

Implement Manager creating a Worker (similar to Create Manager but with PIN support):

**GraphQL Mutation:**
```graphql
mutation CreateWorker($input: CreateWorkerInput!) {
  createWorker(input: $input) {
    user {
      id
      fullName
      hierarchyLevel
    }
    staffProfile {
      id
      positionTitle
      employeeCode
    }
    credentials {
      email
      pin
      hasEmail
      hasPIN
    }
  }
}
```

**Input Type:**
```typescript
interface CreateWorkerInput {
  email?: string;
  password?: string;
  pin?: string; // 4-6 digits
  fullName: string;
  positionTitle: string;
  branchId?: string;
  departmentId?: string;
  permissions: {
    module: string;
    actions: string[];
  }[];
  canCreateSubordinates: boolean; // Grant user_management:create_subordinates
}
```

**Implementation Requirements:**
1. Verify creator has permission to create workers
2. Validate at least one credential type provided (email+password OR pin)
3. If PIN provided:
   - Validate PIN is 4-6 digits
   - Validate PIN uniqueness within organization
   - Hash PIN with bcrypt
4. Validate permissions against creator's matrix
5. Create User record with hierarchy_level = WORKER
6. Create StaffProfile record
7. Create PermissionMatrix records
8. If canCreateSubordinates = true:
   - Add special permission: USER_MANAGEMENT:CREATE_SUBORDINATES
   - This allows Worker to create other Workers below them
9. Emit AuditLog entry
10. Return created user and credentials info

**Task 4.3: Update User Permissions**

Implement permission modification for existing users:

**GraphQL Mutation:**
```graphql
mutation UpdateUserPermissions($userId: ID!, $permissions: [PermissionInput!]!) {
  updateUserPermissions(userId: $userId, permissions: $permissions) {
    user {
      id
      fullName
    }
    updatedPermissions {
      module
      actions
    }
    revokedPermissions {
      module
      actions
    }
    cascadeAffectedUsers {
      id
      fullName
      revokedPermissions {
        module
        actions
      }
    }
  }
}
```

**Implementation Requirements:**
1. Verify updater is the creator of target user OR a superior in hierarchy
2. Validate new permission set against updater's current permissions
3. Identify permissions being added (not in old set)
4. Identify permissions being removed (in old set, not in new set)
5. For added permissions:
   - Validate delegation rules
   - Create new PermissionMatrix records
6. For removed permissions:
   - Mark old PermissionMatrix records as revoked
   - Trigger cascade revocation to all subordinates
7. Invalidate permission cache for user and all affected subordinates
8. Emit AuditLog entries for all changes
9. Return complete change summary including cascade effects

**Task 4.4: Deactivate/Reactivate User**

Implement user status management:

**GraphQL Mutations:**
```graphql
mutation DeactivateUser($userId: ID!, $reason: String!) {
  deactivateUser(userId: $userId, reason: $reason) {
    success
    affectedSubordinates {
      id
      fullName
      action # DEACTIVATED or REASSIGNED
    }
  }
}

mutation ReactivateUser($userId: ID!) {
  reactivateUser(userId: $userId) {
    success
    user {
      id
      status
    }
  }
}
```

**Deactivation Requirements:**
1. Verify requester has authority (creator or superior)
2. Check if user has active subordinates
3. If user has subordinates:
   - Require reassignment of subordinates to another manager
   - Provide list of subordinates that need reassignment
   - Block deactivation until reassignment complete
4. Update User.status = DISABLED
5. Update StaffProfile.employment_status = SUSPENDED
6. Revoke all active sessions (add to Redis blacklist)
7. Emit AuditLog entry with reason
8. Return success and affected subordinates list

**Reactivation Requirements:**
1. Verify requester has authority
2. Update User.status = ACTIVE
3. Update StaffProfile.employment_status = ACTIVE
4. Permissions remain intact (not revoked during deactivation)
5. User can log in again immediately
6. Emit AuditLog entry

**Task 4.5: Transfer Subordinates**

Implement subordinate reassignment when manager leaves:

**GraphQL Mutation:**
```graphql
mutation TransferSubordinates($fromUserId: ID!, $toUserId: ID!, $subordinateIds: [ID!]!) {
  transferSubordinates(
    fromUserId: $fromUserId,
    toUserId: $toUserId,
    subordinateIds: $subordinateIds
  ) {
    success
    transferredUsers {
      id
      fullName
      newReportsTo {
        id
        fullName
      }
    }
  }
}
```

**Implementation Requirements:**
1. Verify requester is OWNER or superior to both users
2. Verify toUser has sufficient permissions to manage subordinates
3. For each subordinate:
   - Verify their permissions are subset of toUser's permissions
   - If not, either adjust subordinate's permissions OR reject transfer
4. Update User.created_by_id = toUserId for all subordinates
5. Update StaffProfile.reports_to_user_id = toUserId
6. Emit AuditLog entries for all transfers
7. Return transfer summary

### PHASE 5: ORGANIZATION STRUCTURE MANAGEMENT

**Task 5.1: Branch Management**

Implement branch creation and management:

**GraphQL Mutations:**
```graphql
mutation CreateBranch($input: CreateBranchInput!) {
  createBranch(input: $input) {
    id
    name
    code
    address
  }
}

mutation AssignBranchManager($branchId: ID!, $managerId: ID!) {
  assignBranchManager(branchId: $branchId, managerId: $managerId) {
    branch {
      id
      name
    }
    manager {
      id
      fullName
    }
  }
}
```

**Implementation Requirements:**
1. Only OWNER can create branches
2. Branch code must be unique within organization
3. When assigning manager to branch:
   - Update User.branch_id = branchId
   - Manager's scope is now limited to this branch
   - All subordinates inherit branch scope
4. Emit AuditLog entries

**Task 5.2: Department Management**

Implement department creation and management:

**GraphQL Mutations:**
```graphql
mutation CreateDepartment($input: CreateDepartmentInput!) {
  createDepartment(input: $input) {
    id
    name
    code
    branchId
  }
}
```

**Implementation Requirements:**
1. OWNER or branch MANAGER can create departments
2. Department can be org-wide (branchId = null) or branch-specific
3. Department code unique within organization
4. Emit AuditLog entries

### PHASE 6: BUSINESS AUTHORIZATION RULES ENGINE

**Task 6.1: Authorization Rule Management**

Implement CRUD for authorization rules:

**GraphQL Mutations:**
```graphql
mutation CreateAuthorizationRule($input: CreateAuthorizationRuleInput!) {
  createAuthorizationRule(input: $input) {
    id
    ruleName
    transactionType
    thresholdValue
    approverLevel
  }
}
```

**Input Type:**
```typescript
interface CreateAuthorizationRuleInput {
  ruleName: string;
  transactionType: string; // SALES_ORDER, PURCHASE_ORDER, INVOICE, etc.
  basedOn: string; // GRAND_TOTAL, DISCOUNT_PERCENT, ITEM_GROUP
  thresholdValue: number;
  appliesToLevel?: HierarchyLevel;
  appliesToUserId?: string;
  approverLevel?: HierarchyLevel;
  approverUserId?: string;
  branchId?: string; // null = org-wide
  priority: number;
}
```

**Implementation Requirements:**
1. Only OWNER or users with SETTINGS:MANAGE_AUTHORIZATION_RULES can create rules
2. Validate approver is different from applies_to user (prevent self-approval)
3. Validate approver has higher hierarchy level than applies_to
4. Store rule in AuthorizationRule table
5. Emit AuditLog entry

**Task 6.2: Rule Evaluation Engine**

Implement the rule evaluation logic used by AuthorizationRulesGuard:

**Service Method:**
```typescript
async evaluateAuthorizationRules(
  userId: string,
  transactionType: string,
  transactionData: any,
  organizationId: string,
  branchId?: string
): Promise<AuthorizationResult> {
  // Implementation as described in Layer 4 guard logic
}
```

**Return Type:**
```typescript
interface AuthorizationResult {
  allowed: boolean;
  requiresApproval: boolean;
  approvers?: {
    userId?: string;
    level?: HierarchyLevel;
    names: string[];
  };
  matchedRule?: AuthorizationRule;
  reason?: string;
}
```

### PHASE 7: AUDIT LOGGING & MONITORING

**Task 7.1: Comprehensive Audit Logging**

Implement audit logging interceptor for ALL operations:

**NestJS Interceptor:**
```typescript
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const userContext = request.user;
    const startTime = Date.now();
    
    return next.handle().pipe(
      tap(
        (data) => {
          // Success case
          this.logAudit({
            userId: userContext?.id,
            organizationId: userContext?.organizationId,
            hierarchyLevel: userContext?.hierarchyLevel,
            action: this.extractAction(context),
            resourceType: this.extractResourceType(context),
            resourceId: this.extractResourceId(data),
            result: 'SUCCESS',
            ipAddress: request.ip,
            metadata: {
              duration: Date.now() - startTime,
              endpoint: request.url,
            },
          });
        },
        (error) => {
          // Error case
          this.logAudit({
            userId: userContext?.id,
            organizationId: userContext?.organizationId,
            hierarchyLevel: userContext?.hierarchyLevel,
            action: this.extractAction(context),
            resourceType: this.extractResourceType(context),
            result: error instanceof ForbiddenException ? 'DENIED' : 'ERROR',
            ipAddress: request.ip,
            metadata: {
              duration: Date.now() - startTime,
              error: error.message,
              endpoint: request.url,
            },
          });
        }
      )
    );
  }
}
```

**Requirements:**
1. Apply interceptor globally to all GraphQL resolvers
2. Log ALL mutations (CREATE, UPDATE, DELETE operations)
3. Log authentication events (LOGIN, LOGOUT, TOKEN_REFRESH)
4. Log authorization denials with reason
5. Log permission grants and revocations
6. Store in AuditLog table (append-only, no updates/deletes)
7. Async logging (don't block request)
8. Include before/after state for UPDATE operations

**Task 7.2: Audit Log Query API**

Implement GraphQL queries for audit log access:

**GraphQL Queries:**
```graphql
query GetAuditLogs($filters: AuditLogFilters!, $pagination: PaginationInput!) {
  auditLogs(filters: $filters, pagination: $pagination) {
    edges {
      id
      userId
      user {
        fullName
      }
      action
      resourceType
      resourceId
      result
      ipAddress
      metadata
      createdAt
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      totalCount
    }
  }
}
```

**Access Control:**
1. OWNER can view all audit logs for organization
2. MANAGER can view logs for their branch/department
3. WORKER cannot access audit logs
4. Implement pagination (max 100 records per page)
5. Support filtering by: date range, user, action, resource type, result

### PHASE 8: GRAPHQL API LAYER

**Task 8.1: GraphQL Schema Design**

Design complete GraphQL schema with proper types, inputs, and resolvers:

**Core Types:**
```graphql
type Organization {
  id: ID!
  name: String!
  type: OrganizationType!
  registeredEmail: String!
  status: OrganizationStatus!
  owner: User!
  branches: [Branch!]!
  departments: [Department!]!
  settings: JSON
  createdAt: DateTime!
}

type User {
  id: ID!
  email: String
  fullName: String!
  hierarchyLevel: HierarchyLevel!
  organization: Organization!
  branch: Branch
  department: Department
  staffProfile: StaffProfile!
  createdBy: User
  subordinates: [User!]!
  permissions: [PermissionGrant!]!
  status: UserStatus!
  lastLoginAt: DateTime
  createdAt: DateTime!
}

type StaffProfile {
  id: ID!
  user: User!
  positionTitle: String!
  employeeCode: String!
  contactNumber: String
  dateOfJoining: Date!
  reportsTo: User
  employmentStatus: EmploymentStatus!
}

type PermissionGrant {
  module: String!
  actions: [String!]!
  grantedBy: User!
  grantedAt: DateTime!
}

type Branch {
  id: ID!
  name: String!
  code: String!
  address: String
  organization: Organization!
  manager: User
  departments: [Department!]!
  isActive: Boolean!
}

type Department {
  id: ID!
  name: String!
  code: String!
  organization: Organization!
  branch: Branch
  manager: User
  isActive: Boolean!
}

enum HierarchyLevel {
  OWNER
  MANAGER
  WORKER
}

enum OrganizationType {
  SOLE_PROPRIETORSHIP
  RETAIL
  WHOLESALE
  MANUFACTURING
}

enum UserStatus {
  ACTIVE
  DISABLED
  SUSPENDED
  LEFT
}
```

**Task 8.2: Resolver Implementation**

Implement all GraphQL resolvers with proper guards and authorization:

**Example Resolver:**
```typescript
@Resolver(() => User)
export class UserResolver {
  constructor(
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  @UseGuards(JwtAuthGuard, HierarchyLevelGuard, PermissionGuard)
  @RequireLevel(HierarchyLevel.MANAGER)
  @RequirePermission('USER_MANAGEMENT', 'CREATE')
  @Mutation(() => User)
  async createWorker(
    @Args('input') input: CreateWorkerInput,
    @CurrentUser() currentUser: UserContext,
  ): Promise<User> {
    return this.userService.createWorker(input, currentUser);
  }

  @UseGuards(JwtAuthGuard, ScopeGuard)
  @RequireScope('BRANCH')
  @Query(() => [User])
  async getTeamMembers(
    @CurrentUser() currentUser: UserContext,
  ): Promise<User[]> {
    return this.userService.getSubordinates(currentUser.id);
  }
}
```

**Requirements:**
1. Apply guards to ALL resolvers except public ones (register, login)
2. Use @CurrentUser() decorator to inject user context
3. Implement field resolvers for nested data (e.g., User.permissions)
4. Use DataLoader pattern for N+1 query prevention
5. Implement proper error handling with custom error codes

### PHASE 9: GRPC INTER-SERVICE COMMUNICATION

**Task 9.1: gRPC Service Definitions**

Define proto files for all services:

**proto/services/auth.proto:**
```protobuf
syntax = "proto3";

package auth;

service AuthService {
  rpc ValidateToken(ValidateTokenRequest) returns (ValidateTokenResponse);
  rpc RefreshToken(RefreshTokenRequest) returns (RefreshTokenResponse);
  rpc RevokeToken(RevokeTokenRequest) returns (RevokeTokenResponse);
}

message ValidateTokenRequest {
  string access_token = 1;
}

message ValidateTokenResponse {
  bool valid = 1;
  string user_id = 2;
  string organization_id = 3;
  string hierarchy_level = 4;
  string permission_fingerprint = 5;
}
```

**proto/services/permission.proto:**
```protobuf
syntax = "proto3";

package permission;

service PermissionService {
  rpc CheckPermission(CheckPermissionRequest) returns (CheckPermissionResponse);
  rpc GetUserPermissions(GetUserPermissionsRequest) returns (GetUserPermissionsResponse);
  rpc GrantPermissions(GrantPermissionsRequest) returns (GrantPermissionsResponse);
  rpc RevokePermissions(RevokePermissionsRequest) returns (RevokePermissionsResponse);
  rpc ValidateDelegation(ValidateDelegationRequest) returns (ValidateDelegationResponse);
}

message CheckPermissionRequest {
  string user_id = 1;
  string module = 2;
  string action = 3;
}

message CheckPermissionResponse {
  bool has_permission = 1;
  string granted_by = 2;
  string granted_at = 3;
}
```

**Task 9.2: gRPC Controller Implementation**

Implement gRPC controllers for each service:

**Example:**
```typescript
@Controller()
export class PermissionGrpcController {
  constructor(private readonly permissionService: PermissionService) {}

  @GrpcMethod('PermissionService', 'CheckPermission')
  async checkPermission(
    data: CheckPermissionRequest,
  ): Promise<CheckPermissionResponse> {
    const result = await this.permissionService.checkPermission(
      data.userId,
      data.module,
      data.action,
    );
    
    return {
      hasPermission: result.hasPermission,
      grantedBy: result.grantedBy,
      grantedAt: result.grantedAt?.toISOString(),
    };
  }
}
```

**Requirements:**
1. Implement all gRPC methods defined in proto files
2. Add gRPC-specific error handling
3. Implement gRPC interceptors for logging and error transformation
4. Configure gRPC server in main.ts
5. Generate TypeScript types from proto files using protoc

### PHASE 10: CACHING STRATEGY

**Task 10.1: Redis Caching Layer**

Implement comprehensive caching for performance:

**Cache Keys:**
```
perm:user:{userId}                          - User's full permission matrix (TTL: 5min)
perm:{userId}:{module}:{action}             - Specific permission check (TTL: 5min)
user:context:{userId}                       - User context data (TTL: 15min)
org:{organizationId}:settings               - Organization settings (TTL: 1hour)
auth:blacklist:refresh:{tokenHash}          - Revoked refresh tokens (TTL: token lifetime)
auth:blacklist:access:{tokenHash}           - Revoked access tokens (TTL: token lifetime)
hierarchy:{userId}:subordinates             - User's subordinate tree (TTL: 10min)
```

**Cache Invalidation Rules:**
1. When permissions granted/revoked: invalidate `perm:user:{userId}` and all `perm:{userId}:*`
2. When user updated: invalidate `user:context:{userId}`
3. When user deactivated: invalidate all user caches + blacklist tokens
4. When organization settings changed: invalidate `org:{organizationId}:settings`
5. When hierarchy changes: invalidate `hierarchy:*` for affected users

**Task 10.2: Cache-Aside Pattern Implementation**

Implement cache-aside pattern for permission checks:

```typescript
async checkPermission(userId: string, module: string, action: string): Promise<boolean> {
  const cacheKey = `perm:${userId}:${module}:${action}`;
  
  // Try cache first
  const cached = await this.redis.get(cacheKey);
  if (cached !== null) {
    return cached === '1';
  }
  
  // Cache miss - query database
  const hasPermission = await this.prisma.permissionMatrix.findFirst({
    where: {
      userId,
      module,
      actions: { has: action },
      isActive: true,
      revokedAt: null,
    },
  });
  
  // Store in cache
  await this.redis.set(cacheKey, hasPermission ? '1' : '0', 'EX', 300);
  
  return !!hasPermission;
}
```

### PHASE 11: TESTING STRATEGY

**Task 11.1: Unit Tests**

Write comprehensive unit tests for:
1. AuthService methods (login, register, token generation)
2. PermissionService methods (delegation validation, cascade revocation)
3. Authorization guards (all four layers)
4. Password hashing and verification
5. JWT token generation and validation
6. PIN validation

**Task 11.2: Integration Tests**

Write integration tests for:
1. Complete registration flow (organization + owner creation)
2. Login flow (email/password and PIN)
3. Token refresh flow
4. Permission grant flow with delegation validation
5. Permission revocation with cascade
6. User creation flow (manager and worker)
7. Authorization rule evaluation
8. Scope filtering in queries

**Task 11.3: E2E Tests**

Write end-to-end tests for:
1. Complete user journey: register → login → create manager → manager creates worker
2. Permission delegation chain: owner → manager → worker → sub-worker
3. Permission revocation cascade across hierarchy
4. Authorization rule enforcement on transactions
5. Scope isolation between branches
6. Audit log generation for all operations

### PHASE 12: SECURITY HARDENING

**Task 12.1: Security Best Practices**

Implement security measures:
1. Rate limiting on login endpoints (max 5 attempts per 15 minutes per IP)
2. Account lockout after 5 failed login attempts (30 minute lockout)
3. Password strength validation (min 8 chars, uppercase, lowercase, number, special)
4. PIN brute force protection (max 3 attempts per 5 minutes)
5. JWT secret rotation mechanism
6. Refresh token rotation on each use (sliding expiry)
7. HTTPS-only in production
8. Secure cookie settings for refresh tokens (httpOnly, secure, sameSite)
9. Input sanitization for all user inputs
10. SQL injection prevention (Prisma handles this)
11. XSS prevention in GraphQL responses
12. CORS configuration for allowed origins only

**Task 12.2: Sensitive Data Protection**

Implement data protection:
1. Never log passwords, PINs, or tokens in plain text
2. Mask sensitive data in audit logs
3. Encrypt sensitive fields in database (if required by compliance)
4. Implement data retention policies for audit logs
5. Secure deletion of user data (GDPR compliance)

### PHASE 13: DOCUMENTATION

**Task 13.1: API Documentation**

Create comprehensive documentation:
1. GraphQL schema documentation with examples
2. gRPC service documentation
3. Authentication flow diagrams
4. Authorization layer diagrams
5. Permission delegation rules and examples
6. Authorization rules configuration guide
7. Error codes and handling guide

**Task 13.2: Developer Guide**

Create developer documentation:
1. Setup and installation guide
2. Environment configuration
3. Database migration guide
4. Testing guide
5. Deployment guide
6. Troubleshooting guide

## IMPLEMENTATION CHECKLIST

Use this checklist to track implementation progress:

### Database & Schema
- [ ] Design complete Prisma schema with all entities
- [ ] Create and apply initial migration
- [ ] Create seed data for modules and actions
- [ ] Implement database indexes for performance
- [ ] Set up Prisma middleware for scope filtering

### Authentication
- [ ] Implement organization registration with Google OAuth
- [ ] Implement email/password login
- [ ] Implement PIN login for workers
- [ ] Implement JWT token generation with full context
- [ ] Implement token refresh mechanism
- [ ] Implement logout and token revocation
- [ ] Implement JWT validation guard
- [ ] Implement session management

### Authorization
- [ ] Implement PermissionService with gRPC interface
- [ ] Implement permission matrix storage and retrieval
- [ ] Implement delegation validation (GOLDEN RULE enforcement)
- [ ] Implement cascade revocation algorithm
- [ ] Implement Layer 1: Hierarchy Level Guard
- [ ] Implement Layer 2: Permission Guard
- [ ] Implement Layer 3: Scope Guard
- [ ] Implement Layer 4: Business Authorization Rules Guard
- [ ] Implement automatic scope filtering in Prisma queries

### User Management
- [ ] Implement create manager flow
- [ ] Implement create worker flow
- [ ] Implement update user permissions
- [ ] Implement user deactivation/reactivation
- [ ] Implement subordinate transfer
- [ ] Implement user listing with hierarchy tree

### Organization Structure
- [ ] Implement branch CRUD operations
- [ ] Implement department CRUD operations
- [ ] Implement branch manager assignment
- [ ] Implement department manager assignment

### Business Rules
- [ ] Implement authorization rule CRUD
- [ ] Implement rule evaluation engine
- [ ] Implement rule priority resolution
- [ ] Implement approver validation

### Audit & Monitoring
- [ ] Implement audit log interceptor
- [ ] Implement audit log storage
- [ ] Implement audit log query API
- [ ] Implement audit log retention policy

### GraphQL API
- [ ] Design complete GraphQL schema
- [ ] Implement all resolvers with guards
- [ ] Implement field resolvers for nested data
- [ ] Implement DataLoader for N+1 prevention
- [ ] Implement error handling and formatting

### gRPC Services
- [ ] Define all proto files
- [ ] Generate TypeScript types from protos
- [ ] Implement gRPC controllers
- [ ] Implement gRPC interceptors
- [ ] Configure gRPC server

### Caching
- [ ] Implement Redis caching for permissions
- [ ] Implement cache invalidation logic
- [ ] Implement token blacklisting in Redis
- [ ] Implement cache-aside pattern

### Testing
- [ ] Write unit tests for auth service
- [ ] Write unit tests for permission service
- [ ] Write unit tests for guards
- [ ] Write integration tests for flows
- [ ] Write E2E tests for user journeys
- [ ] Achieve >80% code coverage

### Security
- [ ] Implement rate limiting
- [ ] Implement account lockout
- [ ] Implement password strength validation
- [ ] Implement PIN brute force protection
- [ ] Implement JWT secret rotation
- [ ] Implement refresh token rotation
- [ ] Configure CORS properly
- [ ] Implement input sanitization

### Documentation
- [ ] Write API documentation
- [ ] Write developer guide
- [ ] Create flow diagrams
- [ ] Write deployment guide
- [ ] Write troubleshooting guide

## CRITICAL SUCCESS FACTORS

1. **THE GOLDEN RULE MUST BE ENFORCED**: No user can ever grant permissions they don't have. This is validated at every permission grant operation.

2. **ATOMIC TRANSACTIONS**: Organization creation, user creation, and permission grants must be atomic. If any step fails, rollback everything.

3. **CASCADE REVOCATION MUST BE RELIABLE**: When permissions are revoked, the cascade must reach all affected subordinates without failure.

4. **AUDIT TRAIL IS IMMUTABLE**: No user, including OWNER, can delete or modify audit logs.

5. **SCOPE ISOLATION IS AUTOMATIC**: Non-owner users can never see data outside their scope, enforced at database query level.

6. **PERFORMANCE IS CRITICAL**: Permission checks happen on every request. Caching is mandatory.

7. **SECURITY IS NON-NEGOTIABLE**: Passwords and PINs must be hashed. Tokens must be validated. Rate limiting must be enforced.

## FINAL NOTES

This is a complex, hierarchical authentication and authorization system that requires careful implementation. Each phase builds on the previous one. Do not skip phases or take shortcuts.

The system is designed to be flexible enough to support any organizational structure while maintaining strict security and permission boundaries.

Test thoroughly at each phase before moving to the next. The permission delegation and cascade revocation logic is particularly critical and must be tested extensively.

Good luck with the implementation!
