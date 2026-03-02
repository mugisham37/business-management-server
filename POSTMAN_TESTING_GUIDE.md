# Complete Postman Testing Guide for ERP System

## Table of Contents
1. [Project Overview](#project-overview)
2. [Server Configuration](#server-configuration)
3. [GraphQL Endpoints](#graphql-endpoints)
4. [gRPC Endpoints](#grpc-endpoints)
5. [Authentication Flow](#authentication-flow)
6. [Testing Scenarios](#testing-scenarios)

---

## Project Overview

This NestJS-based ERP system provides both **GraphQL** and **gRPC** APIs with a hierarchical authorization system supporting three user levels:
- **OWNER**: Full organization access
- **MANAGER**: Branch/department level access
- **WORKER**: Limited access, can use PIN authentication

### Technology Stack
- **Framework**: NestJS 11.x
- **Database**: PostgreSQL (Neon serverless)
- **Cache**: Redis
- **APIs**: GraphQL (Apollo) + gRPC
- **Authentication**: JWT with refresh tokens

---

## Server Configuration

### Base URLs
```
HTTP/GraphQL: http://localhost:3001
GraphQL Endpoint: http://localhost:3001/graphql
gRPC Endpoint: 0.0.0.0:5000
```

### Environment Variables
- **NODE_ENV**: development
- **PORT**: 3001 (fixed, cannot be changed)
- **JWT_SECRET**: 0124676fb9583a3082f6d20ba3ef9cf32ceeaa3199c56475d24cf1df0f385109
- **JWT_EXPIRES_IN**: 15m
- **REFRESH_TOKEN_EXPIRES_IN**: 7d


---

## GraphQL Endpoints

### Postman Setup for GraphQL

**Collection Settings:**
1. Create a new collection named "ERP System - GraphQL"
2. Add collection variables:
   - `baseUrl`: `http://localhost:3001`
   - `graphqlUrl`: `{{baseUrl}}/graphql`
   - `accessToken`: (will be set after login)
   - `refreshToken`: (will be set after login)
   - `organizationId`: (will be set after registration)
   - `userId`: (will be set after login)

**Request Headers (for authenticated requests):**
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

---

### 1. Authentication & Session Management

#### 1.1 Register Owner (Public)
**Purpose**: Create a new organization with an owner account

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
```

**Body** (GraphQL):
```graphql
mutation RegisterOwner {
  registerOwner(input: {
    email: "owner@example.com"
    password: "SecurePass123!"
    firstName: "John"
    lastName: "Doe"
    organizationName: "Acme Corporation"
    organizationType: "ENTERPRISE"
  }) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      email
      firstName
      lastName
      hierarchyLevel
      organizationId
    }
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "registerOwner": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900,
      "user": {
        "id": "uuid-here",
        "email": "owner@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "hierarchyLevel": "OWNER",
        "organizationId": "org-uuid-here"
      }
    }
  }
}
```

**Post-Request Script** (Save tokens):
```javascript
const response = pm.response.json();
if (response.data && response.data.registerOwner) {
    pm.collectionVariables.set("accessToken", response.data.registerOwner.accessToken);
    pm.collectionVariables.set("refreshToken", response.data.registerOwner.refreshToken);
    pm.collectionVariables.set("organizationId", response.data.registerOwner.user.organizationId);
    pm.collectionVariables.set("userId", response.data.registerOwner.user.id);
}
```

**Validation Rules**:
- Email: Must be valid email format
- Password: Min 8 chars, must contain uppercase, lowercase, number, and special character
- Organization Type: Must be one of: `ENTERPRISE`, `SME`, `STARTUP`


#### 1.2 Login with Password (Public)
**Purpose**: Authenticate existing user with email and password

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
```

**Body** (GraphQL):
```graphql
mutation Login {
  login(input: {
    email: "owner@example.com"
    password: "SecurePass123!"
    organizationId: "{{organizationId}}"
  }) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      email
      firstName
      lastName
      hierarchyLevel
      organizationId
    }
  }
}
```

**Expected Response**: Same structure as registerOwner

**Post-Request Script**: Same as registerOwner

**Rate Limiting**: 5 attempts per 15 minutes per IP

---

#### 1.3 Login with PIN (Public - Workers Only)
**Purpose**: Authenticate worker users using PIN instead of password

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
```

**Body** (GraphQL):
```graphql
mutation LoginWithPin {
  loginWithPin(input: {
    email: "worker@example.com"
    pin: "123456"
    organizationId: "{{organizationId}}"
  }) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      email
      firstName
      lastName
      hierarchyLevel
      organizationId
    }
  }
}
```

**Expected Response**: Same structure as login

**Notes**:
- Only available for WORKER hierarchy level
- PIN is 6 digits
- Rate limited: 5 attempts per 15 minutes

---

#### 1.4 Refresh Token (Public)
**Purpose**: Get new access token using refresh token

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
```

**Body** (GraphQL):
```graphql
mutation RefreshToken {
  refreshToken(input: {
    refreshToken: "{{refreshToken}}"
  }) {
    accessToken
    refreshToken
    expiresIn
    user {
      id
      email
      firstName
      lastName
      hierarchyLevel
      organizationId
    }
  }
}
```

**Expected Response**: New tokens with same structure

**Post-Request Script**: Update tokens
```javascript
const response = pm.response.json();
if (response.data && response.data.refreshToken) {
    pm.collectionVariables.set("accessToken", response.data.refreshToken.accessToken);
    pm.collectionVariables.set("refreshToken", response.data.refreshToken.refreshToken);
}
```


#### 1.5 Logout (Authenticated)
**Purpose**: Revoke current session and blacklist access token

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation Logout {
  logout
}
```

**Expected Response**:
```json
{
  "data": {
    "logout": true
  }
}
```

---

#### 1.6 Change Password (Authenticated)
**Purpose**: Change user password with current password verification

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation ChangePassword {
  changePassword(input: {
    currentPassword: "SecurePass123!"
    newPassword: "NewSecurePass456!"
  })
}
```

**Expected Response**:
```json
{
  "data": {
    "changePassword": true
  }
}
```

**Notes**:
- New password must meet same validation rules
- All other sessions are revoked except current one

---

#### 1.7 Get Active Sessions (Authenticated)
**Purpose**: View all active sessions for current user

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetActiveSessions {
  getActiveSessions {
    id
    ipAddress
    userAgent
    createdAt
    expiresAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getActiveSessions": [
      {
        "id": "session-uuid",
        "ipAddress": "127.0.0.1",
        "userAgent": "PostmanRuntime/7.x",
        "createdAt": "2026-03-02T10:00:00.000Z",
        "expiresAt": "2026-03-09T10:00:00.000Z"
      }
    ]
  }
}
```

---

#### 1.8 Revoke Session (Authenticated)
**Purpose**: Revoke a specific session

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation RevokeSession {
  revokeSession(input: {
    sessionId: "session-uuid-to-revoke"
  })
}
```

**Expected Response**:
```json
{
  "data": {
    "revokeSession": true
  }
}
```

---

#### 1.9 Revoke All Sessions (Authenticated)
**Purpose**: Revoke all sessions except the current one

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation RevokeAllSessions {
  revokeAllSessions
}
```

**Expected Response**:
```json
{
  "data": {
    "revokeAllSessions": true
  }
}
```


---

### 2. User Management

#### 2.1 Create Manager (Owner Only)
**Purpose**: Create a manager user (requires OWNER hierarchy level)

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation CreateManager {
  createManager(input: {
    email: "manager@example.com"
    firstName: "Jane"
    lastName: "Smith"
    organizationId: "{{organizationId}}"
    branchId: "branch-uuid-optional"
    departmentId: "dept-uuid-optional"
    staffProfile: {
      fullName: "Jane Smith"
      positionTitle: "Branch Manager"
      employeeCode: "MGR001"
      hireDate: "2026-03-01T00:00:00.000Z"
    }
  }) {
    user {
      id
      email
      firstName
      lastName
      hierarchyLevel
      status
      organizationId
      branchId
      departmentId
      staffProfile {
        id
        fullName
        positionTitle
        employeeCode
        hireDate
      }
      createdAt
      updatedAt
    }
    temporaryCredential
    credentialType
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "createManager": {
      "user": {
        "id": "manager-uuid",
        "email": "manager@example.com",
        "firstName": "Jane",
        "lastName": "Smith",
        "hierarchyLevel": "MANAGER",
        "status": "ACTIVE",
        "organizationId": "org-uuid",
        "branchId": "branch-uuid",
        "departmentId": null,
        "staffProfile": {
          "id": "profile-uuid",
          "fullName": "Jane Smith",
          "positionTitle": "Branch Manager",
          "employeeCode": "MGR001",
          "hireDate": "2026-03-01T00:00:00.000Z"
        },
        "createdAt": "2026-03-02T10:00:00.000Z",
        "updatedAt": "2026-03-02T10:00:00.000Z"
      },
      "temporaryCredential": "TempPass123!",
      "credentialType": "password"
    }
  }
}
```

**Required Permissions**: USERS:CREATE  
**Required Hierarchy**: OWNER

**Post-Request Script** (Save manager ID):
```javascript
const response = pm.response.json();
if (response.data && response.data.createManager) {
    pm.collectionVariables.set("managerId", response.data.createManager.user.id);
}
```


#### 2.2 Create Worker (Manager or Owner)
**Purpose**: Create a worker user (requires MANAGER or OWNER hierarchy level)

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation CreateWorker {
  createWorker(input: {
    email: "worker@example.com"
    firstName: "Bob"
    lastName: "Johnson"
    organizationId: "{{organizationId}}"
    usePIN: true
    staffProfile: {
      fullName: "Bob Johnson"
      positionTitle: "Sales Associate"
      employeeCode: "WRK001"
      hireDate: "2026-03-01T00:00:00.000Z"
    }
  }) {
    user {
      id
      email
      firstName
      lastName
      hierarchyLevel
      status
      organizationId
      staffProfile {
        id
        fullName
        positionTitle
        employeeCode
        hireDate
      }
      createdAt
      updatedAt
    }
    temporaryCredential
    credentialType
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "createWorker": {
      "user": {
        "id": "worker-uuid",
        "email": "worker@example.com",
        "firstName": "Bob",
        "lastName": "Johnson",
        "hierarchyLevel": "WORKER",
        "status": "ACTIVE",
        "organizationId": "org-uuid",
        "staffProfile": {
          "id": "profile-uuid",
          "fullName": "Bob Johnson",
          "positionTitle": "Sales Associate",
          "employeeCode": "WRK001",
          "hireDate": "2026-03-01T00:00:00.000Z"
        },
        "createdAt": "2026-03-02T10:00:00.000Z",
        "updatedAt": "2026-03-02T10:00:00.000Z"
      },
      "temporaryCredential": "123456",
      "credentialType": "pin"
    }
  }
}
```

**Required Permissions**: USERS:CREATE  
**Required Hierarchy**: MANAGER or OWNER

**Notes**:
- If `usePIN: true`, credentialType will be "pin" (6 digits)
- If `usePIN: false`, credentialType will be "password"

**Post-Request Script** (Save worker ID):
```javascript
const response = pm.response.json();
if (response.data && response.data.createWorker) {
    pm.collectionVariables.set("workerId", response.data.createWorker.user.id);
}
```

---

#### 2.3 Update User (Authenticated)
**Purpose**: Update user details

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation UpdateUser {
  updateUser(
    userId: "{{workerId}}"
    input: {
      firstName: "Robert"
      lastName: "Johnson"
      email: "robert.johnson@example.com"
      status: "ACTIVE"
      branchId: "branch-uuid"
      departmentId: "dept-uuid"
    }
  ) {
    id
    email
    firstName
    lastName
    hierarchyLevel
    status
    organizationId
    branchId
    departmentId
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "updateUser": {
      "id": "worker-uuid",
      "email": "robert.johnson@example.com",
      "firstName": "Robert",
      "lastName": "Johnson",
      "hierarchyLevel": "WORKER",
      "status": "ACTIVE",
      "organizationId": "org-uuid",
      "branchId": "branch-uuid",
      "departmentId": "dept-uuid",
      "createdAt": "2026-03-02T10:00:00.000Z",
      "updatedAt": "2026-03-02T10:15:00.000Z"
    }
  }
}
```

**Required Permissions**: USERS:UPDATE

**Valid Status Values**: `ACTIVE`, `INACTIVE`, `LOCKED`


#### 2.4 Get User (Authenticated)
**Purpose**: Retrieve user details by ID

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetUser {
  getUser(userId: "{{workerId}}") {
    id
    email
    firstName
    lastName
    hierarchyLevel
    status
    organizationId
    branchId
    departmentId
    createdById
    staffProfile {
      id
      fullName
      positionTitle
      employeeCode
      hireDate
      reportsToUserId
    }
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getUser": {
      "id": "worker-uuid",
      "email": "worker@example.com",
      "firstName": "Bob",
      "lastName": "Johnson",
      "hierarchyLevel": "WORKER",
      "status": "ACTIVE",
      "organizationId": "org-uuid",
      "branchId": null,
      "departmentId": null,
      "createdById": "manager-uuid",
      "staffProfile": {
        "id": "profile-uuid",
        "fullName": "Bob Johnson",
        "positionTitle": "Sales Associate",
        "employeeCode": "WRK001",
        "hireDate": "2026-03-01T00:00:00.000Z",
        "reportsToUserId": null
      },
      "createdAt": "2026-03-02T10:00:00.000Z",
      "updatedAt": "2026-03-02T10:00:00.000Z"
    }
  }
}
```

**Required Permissions**: USERS:READ

**Notes**: Scope filtering applies - users can only see users within their hierarchy scope

---

#### 2.5 Get Users List (Authenticated)
**Purpose**: Retrieve all users with scope filtering

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetUsers {
  getUsers {
    users {
      id
      email
      firstName
      lastName
      hierarchyLevel
      status
      organizationId
      branchId
      departmentId
      staffProfile {
        fullName
        positionTitle
        employeeCode
      }
      createdAt
      updatedAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getUsers": {
      "users": [
        {
          "id": "user-uuid-1",
          "email": "owner@example.com",
          "firstName": "John",
          "lastName": "Doe",
          "hierarchyLevel": "OWNER",
          "status": "ACTIVE",
          "organizationId": "org-uuid",
          "branchId": null,
          "departmentId": null,
          "staffProfile": null,
          "createdAt": "2026-03-02T09:00:00.000Z",
          "updatedAt": "2026-03-02T09:00:00.000Z"
        },
        {
          "id": "user-uuid-2",
          "email": "manager@example.com",
          "firstName": "Jane",
          "lastName": "Smith",
          "hierarchyLevel": "MANAGER",
          "status": "ACTIVE",
          "organizationId": "org-uuid",
          "branchId": "branch-uuid",
          "departmentId": null,
          "staffProfile": {
            "fullName": "Jane Smith",
            "positionTitle": "Branch Manager",
            "employeeCode": "MGR001"
          },
          "createdAt": "2026-03-02T09:30:00.000Z",
          "updatedAt": "2026-03-02T09:30:00.000Z"
        }
      ],
      "total": 2
    }
  }
}
```

**Required Permissions**: USERS:READ

**Scope Filtering**:
- OWNER: Sees all users in organization
- MANAGER: Sees users in their branch/department
- WORKER: Sees only themselves


---

### 3. Organization Management

#### 3.1 Get Organization (Authenticated)
**Purpose**: Retrieve current user's organization details

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetOrganization {
  getOrganization {
    id
    name
    type
    status
    ownerId
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getOrganization": {
      "id": "org-uuid",
      "name": "Acme Corporation",
      "type": "ENTERPRISE",
      "status": "ACTIVE",
      "ownerId": "owner-uuid",
      "createdAt": "2026-03-02T09:00:00.000Z",
      "updatedAt": "2026-03-02T09:00:00.000Z"
    }
  }
}
```

**Valid Organization Types**: `ENTERPRISE`, `SME`, `STARTUP`  
**Valid Organization Status**: `ACTIVE`, `SUSPENDED`, `INACTIVE`

---

#### 3.2 Update Organization (Owner Only)
**Purpose**: Update organization details

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation UpdateOrganization {
  updateOrganization(input: {
    name: "Acme Corporation Ltd"
    type: "ENTERPRISE"
    status: "ACTIVE"
  }) {
    id
    name
    type
    status
    ownerId
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "updateOrganization": {
      "id": "org-uuid",
      "name": "Acme Corporation Ltd",
      "type": "ENTERPRISE",
      "status": "ACTIVE",
      "ownerId": "owner-uuid",
      "createdAt": "2026-03-02T09:00:00.000Z",
      "updatedAt": "2026-03-02T10:30:00.000Z"
    }
  }
}
```

**Required Hierarchy**: OWNER

---

### 4. Branch Management

#### 4.1 Create Branch (Owner Only)
**Purpose**: Create a new branch

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation CreateBranch {
  createBranch(input: {
    organizationId: "{{organizationId}}"
    name: "Downtown Branch"
    code: "DT001"
    address: "123 Main St, City, State 12345"
  }) {
    id
    organizationId
    name
    code
    address
    managerId
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "createBranch": {
      "id": "branch-uuid",
      "organizationId": "org-uuid",
      "name": "Downtown Branch",
      "code": "DT001",
      "address": "123 Main St, City, State 12345",
      "managerId": null,
      "createdAt": "2026-03-02T10:00:00.000Z",
      "updatedAt": "2026-03-02T10:00:00.000Z"
    }
  }
}
```

**Required Hierarchy**: OWNER

**Post-Request Script** (Save branch ID):
```javascript
const response = pm.response.json();
if (response.data && response.data.createBranch) {
    pm.collectionVariables.set("branchId", response.data.createBranch.id);
}
```

**Notes**: Branch code must be unique within the organization


#### 4.2 Update Branch (Owner Only)
**Purpose**: Update branch details

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation UpdateBranch {
  updateBranch(
    branchId: "{{branchId}}"
    input: {
      name: "Downtown Main Branch"
      code: "DT001"
      address: "123 Main Street, Suite 100, City, State 12345"
    }
  ) {
    id
    organizationId
    name
    code
    address
    managerId
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "updateBranch": {
      "id": "branch-uuid",
      "organizationId": "org-uuid",
      "name": "Downtown Main Branch",
      "code": "DT001",
      "address": "123 Main Street, Suite 100, City, State 12345",
      "managerId": null,
      "createdAt": "2026-03-02T10:00:00.000Z",
      "updatedAt": "2026-03-02T10:45:00.000Z"
    }
  }
}
```

**Required Hierarchy**: OWNER

---

#### 4.3 Get Branches (Authenticated)
**Purpose**: Retrieve all branches

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetBranches {
  getBranches {
    branches {
      id
      organizationId
      name
      code
      address
      managerId
      createdAt
      updatedAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getBranches": {
      "branches": [
        {
          "id": "branch-uuid-1",
          "organizationId": "org-uuid",
          "name": "Downtown Branch",
          "code": "DT001",
          "address": "123 Main St, City, State 12345",
          "managerId": "manager-uuid",
          "createdAt": "2026-03-02T10:00:00.000Z",
          "updatedAt": "2026-03-02T10:00:00.000Z"
        }
      ],
      "total": 1
    }
  }
}
```

---

#### 4.4 Assign Branch Manager (Owner Only)
**Purpose**: Assign a manager to a branch

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation AssignBranchManager {
  assignBranchManager(
    branchId: "{{branchId}}"
    managerId: "{{managerId}}"
  )
}
```

**Expected Response**:
```json
{
  "data": {
    "assignBranchManager": true
  }
}
```

**Required Hierarchy**: OWNER

**Notes**: Manager must have MANAGER hierarchy level


---

### 5. Department Management

#### 5.1 Create Department (Owner Only)
**Purpose**: Create a new department

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation CreateDepartment {
  createDepartment(input: {
    organizationId: "{{organizationId}}"
    branchId: "{{branchId}}"
    name: "Sales Department"
    code: "SALES001"
  }) {
    id
    organizationId
    branchId
    name
    code
    managerId
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "createDepartment": {
      "id": "dept-uuid",
      "organizationId": "org-uuid",
      "branchId": "branch-uuid",
      "name": "Sales Department",
      "code": "SALES001",
      "managerId": null,
      "createdAt": "2026-03-02T11:00:00.000Z",
      "updatedAt": "2026-03-02T11:00:00.000Z"
    }
  }
}
```

**Required Hierarchy**: OWNER

**Post-Request Script** (Save department ID):
```javascript
const response = pm.response.json();
if (response.data && response.data.createDepartment) {
    pm.collectionVariables.set("departmentId", response.data.createDepartment.id);
}
```

**Notes**: 
- Department code must be unique within the organization
- branchId is optional (department can be organization-wide)

---

#### 5.2 Update Department (Owner Only)
**Purpose**: Update department details

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation UpdateDepartment {
  updateDepartment(
    departmentId: "{{departmentId}}"
    input: {
      name: "Sales & Marketing Department"
      code: "SALES001"
      branchId: "{{branchId}}"
    }
  ) {
    id
    organizationId
    branchId
    name
    code
    managerId
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "updateDepartment": {
      "id": "dept-uuid",
      "organizationId": "org-uuid",
      "branchId": "branch-uuid",
      "name": "Sales & Marketing Department",
      "code": "SALES001",
      "managerId": null,
      "createdAt": "2026-03-02T11:00:00.000Z",
      "updatedAt": "2026-03-02T11:15:00.000Z"
    }
  }
}
```

**Required Hierarchy**: OWNER

---

#### 5.3 Get Departments (Authenticated)
**Purpose**: Retrieve all departments

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetDepartments {
  getDepartments {
    departments {
      id
      organizationId
      branchId
      name
      code
      managerId
      createdAt
      updatedAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getDepartments": {
      "departments": [
        {
          "id": "dept-uuid-1",
          "organizationId": "org-uuid",
          "branchId": "branch-uuid",
          "name": "Sales Department",
          "code": "SALES001",
          "managerId": "manager-uuid",
          "createdAt": "2026-03-02T11:00:00.000Z",
          "updatedAt": "2026-03-02T11:00:00.000Z"
        }
      ],
      "total": 1
    }
  }
}
```

---

#### 5.4 Assign Department Manager (Owner Only)
**Purpose**: Assign a manager to a department

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation AssignDepartmentManager {
  assignDepartmentManager(
    departmentId: "{{departmentId}}"
    managerId: "{{managerId}}"
  )
}
```

**Expected Response**:
```json
{
  "data": {
    "assignDepartmentManager": true
  }
}
```

**Required Hierarchy**: OWNER


---

### 6. Permission Management

#### 6.1 Grant Permissions (Owner or Manager)
**Purpose**: Grant module permissions to a user

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation GrantPermissions {
  grantPermissions(input: {
    userId: "{{workerId}}"
    permissions: [
      {
        module: "INVENTORY"
        actions: ["READ", "CREATE", "UPDATE"]
      },
      {
        module: "SALES"
        actions: ["READ", "CREATE"]
      }
    ]
  })
}
```

**Expected Response**:
```json
{
  "data": {
    "grantPermissions": true
  }
}
```

**Required Permissions**: USERS:UPDATE

**Common Modules**:
- USERS
- INVENTORY
- SALES
- PURCHASES
- FINANCE
- REPORTS

**Common Actions**:
- READ
- CREATE
- UPDATE
- DELETE
- APPROVE

---

#### 6.2 Revoke Permissions (Owner or Manager)
**Purpose**: Revoke module permissions from a user

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation RevokePermissions {
  revokePermissions(input: {
    userId: "{{workerId}}"
    modules: ["INVENTORY", "SALES"]
  })
}
```

**Expected Response**:
```json
{
  "data": {
    "revokePermissions": true
  }
}
```

**Required Permissions**: USERS:UPDATE

**Notes**: This revokes ALL permissions for the specified modules

---

#### 6.3 Get User Permissions (Authenticated)
**Purpose**: Retrieve all active permissions for a user

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetUserPermissions {
  getUserPermissions(userId: "{{workerId}}") {
    userId
    permissions {
      module
      actions
    }
    fingerprint
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getUserPermissions": {
      "userId": "worker-uuid",
      "permissions": [
        {
          "module": "INVENTORY",
          "actions": ["READ", "CREATE", "UPDATE"]
        },
        {
          "module": "SALES",
          "actions": ["READ", "CREATE"]
        }
      ],
      "fingerprint": "abc123def456..."
    }
  }
}
```

**Required Permissions**: USERS:READ

**Notes**: Fingerprint is a hash of all permissions, used for cache invalidation

---

#### 6.4 Get Permission History (Authenticated)
**Purpose**: Retrieve permission change history for a user

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetPermissionHistory {
  getPermissionHistory(userId: "{{workerId}}") {
    userId
    snapshots {
      id
      userId
      snapshotData
      fingerprintHash
      reason
      createdAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getPermissionHistory": {
      "userId": "worker-uuid",
      "snapshots": [
        {
          "id": "snapshot-uuid-1",
          "userId": "worker-uuid",
          "snapshotData": {
            "INVENTORY": ["READ", "CREATE"],
            "SALES": ["READ"]
          },
          "fingerprintHash": "abc123...",
          "reason": "PERMISSION_GRANT",
          "createdAt": "2026-03-02T10:00:00.000Z"
        },
        {
          "id": "snapshot-uuid-2",
          "userId": "worker-uuid",
          "snapshotData": {
            "INVENTORY": ["READ", "CREATE", "UPDATE"],
            "SALES": ["READ", "CREATE"]
          },
          "fingerprintHash": "def456...",
          "reason": "PERMISSION_GRANT",
          "createdAt": "2026-03-02T11:00:00.000Z"
        }
      ],
      "total": 2
    }
  }
}
```

**Required Permissions**: USERS:READ

**Snapshot Reasons**:
- PERMISSION_GRANT
- PERMISSION_REVOKE
- USER_CREATED
- ROLE_CHANGE


---

### 7. Business Rules Management

#### 7.1 Create Business Rule (Owner Only)
**Purpose**: Create authorization business rule for transaction approval

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation CreateBusinessRule {
  createBusinessRule(input: {
    ruleName: "High Value Sales Approval"
    transactionType: "SALE"
    basedOn: "AMOUNT"
    thresholdValue: 10000.00
    appliesToLevel: "WORKER"
    approverLevel: "MANAGER"
    priority: 1
  }) {
    id
    organizationId
    ruleName
    transactionType
    basedOn
    thresholdValue
    appliesToLevel
    approverLevel
    isActive
    priority
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "createBusinessRule": {
      "id": "rule-uuid",
      "organizationId": "org-uuid",
      "ruleName": "High Value Sales Approval",
      "transactionType": "SALE",
      "basedOn": "AMOUNT",
      "thresholdValue": 10000.00,
      "appliesToLevel": "WORKER",
      "approverLevel": "MANAGER",
      "isActive": true,
      "priority": 1,
      "createdAt": "2026-03-02T12:00:00.000Z",
      "updatedAt": "2026-03-02T12:00:00.000Z"
    }
  }
}
```

**Required Hierarchy**: OWNER

**Post-Request Script** (Save rule ID):
```javascript
const response = pm.response.json();
if (response.data && response.data.createBusinessRule) {
    pm.collectionVariables.set("ruleId", response.data.createBusinessRule.id);
}
```

**Valid Transaction Types**:
- SALE
- PURCHASE
- PAYMENT
- REFUND
- TRANSFER
- ADJUSTMENT

**Valid Based On**:
- AMOUNT
- QUANTITY
- DISCOUNT_PERCENTAGE

**Valid Hierarchy Levels**:
- OWNER
- MANAGER
- WORKER

---

#### 7.2 Update Business Rule (Owner Only)
**Purpose**: Update existing business rule

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
mutation UpdateBusinessRule {
  updateBusinessRule(
    ruleId: "{{ruleId}}"
    input: {
      ruleName: "High Value Sales Approval - Updated"
      thresholdValue: 15000.00
      isActive: true
      priority: 1
    }
  ) {
    id
    organizationId
    ruleName
    transactionType
    basedOn
    thresholdValue
    appliesToLevel
    approverLevel
    isActive
    priority
    createdAt
    updatedAt
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "updateBusinessRule": {
      "id": "rule-uuid",
      "organizationId": "org-uuid",
      "ruleName": "High Value Sales Approval - Updated",
      "transactionType": "SALE",
      "basedOn": "AMOUNT",
      "thresholdValue": 15000.00,
      "appliesToLevel": "WORKER",
      "approverLevel": "MANAGER",
      "isActive": true,
      "priority": 1,
      "createdAt": "2026-03-02T12:00:00.000Z",
      "updatedAt": "2026-03-02T12:30:00.000Z"
    }
  }
}
```

**Required Hierarchy**: OWNER

---

#### 7.3 Get Business Rules (Authenticated)
**Purpose**: Retrieve business rules, optionally filtered by transaction type

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetBusinessRules {
  getBusinessRules(transactionType: "SALE") {
    rules {
      id
      organizationId
      ruleName
      transactionType
      basedOn
      thresholdValue
      appliesToLevel
      approverLevel
      isActive
      priority
      createdAt
      updatedAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getBusinessRules": {
      "rules": [
        {
          "id": "rule-uuid-1",
          "organizationId": "org-uuid",
          "ruleName": "High Value Sales Approval",
          "transactionType": "SALE",
          "basedOn": "AMOUNT",
          "thresholdValue": 10000.00,
          "appliesToLevel": "WORKER",
          "approverLevel": "MANAGER",
          "isActive": true,
          "priority": 1,
          "createdAt": "2026-03-02T12:00:00.000Z",
          "updatedAt": "2026-03-02T12:00:00.000Z"
        }
      ],
      "total": 1
    }
  }
}
```

**Notes**: 
- If transactionType is omitted, returns all rules
- Rules are ordered by priority (lower number = higher priority)


---

### 8. Audit Logs

#### 8.1 Get User Audit Logs (Authenticated)
**Purpose**: Retrieve audit logs for a specific user

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetUserAuditLogs {
  getUserAuditLogs(
    userId: "{{workerId}}"
    filters: {
      action: "USER_LOGIN"
      resourceType: "user"
      startDate: "2026-03-01T00:00:00.000Z"
      endDate: "2026-03-03T00:00:00.000Z"
      limit: 50
      offset: 0
    }
  ) {
    logs {
      id
      userId
      organizationId
      hierarchyLevel
      action
      resourceType
      resourceId
      result
      metadata
      oldValue
      newValue
      ipAddress
      userAgent
      createdAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getUserAuditLogs": {
      "logs": [
        {
          "id": "audit-uuid-1",
          "userId": "worker-uuid",
          "organizationId": "org-uuid",
          "hierarchyLevel": "WORKER",
          "action": "USER_LOGIN",
          "resourceType": "user",
          "resourceId": "worker-uuid",
          "result": "SUCCESS",
          "metadata": {
            "loginMethod": "password"
          },
          "oldValue": null,
          "newValue": null,
          "ipAddress": "127.0.0.1",
          "userAgent": "PostmanRuntime/7.x",
          "createdAt": "2026-03-02T10:00:00.000Z"
        }
      ],
      "total": 1
    }
  }
}
```

**Required Permissions**: USERS:READ

**Common Actions**:
- USER_LOGIN
- USER_LOGOUT
- USER_CREATED
- USER_UPDATED
- PERMISSION_GRANTED
- PERMISSION_REVOKED
- PASSWORD_CHANGED

**Common Results**:
- SUCCESS
- FAILURE
- DENIED

---

#### 8.2 Get Organization Audit Logs (Owner Only)
**Purpose**: Retrieve all audit logs for the organization

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetOrganizationAuditLogs {
  getOrganizationAuditLogs(
    organizationId: "{{organizationId}}"
    filters: {
      action: "USER_CREATED"
      resourceType: "user"
      startDate: "2026-03-01T00:00:00.000Z"
      endDate: "2026-03-03T00:00:00.000Z"
      limit: 100
      offset: 0
    }
  ) {
    logs {
      id
      userId
      organizationId
      hierarchyLevel
      action
      resourceType
      resourceId
      result
      metadata
      oldValue
      newValue
      ipAddress
      userAgent
      createdAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getOrganizationAuditLogs": {
      "logs": [
        {
          "id": "audit-uuid-1",
          "userId": "owner-uuid",
          "organizationId": "org-uuid",
          "hierarchyLevel": "OWNER",
          "action": "USER_CREATED",
          "resourceType": "user",
          "resourceId": "manager-uuid",
          "result": "SUCCESS",
          "metadata": {
            "createdUserLevel": "MANAGER"
          },
          "oldValue": null,
          "newValue": {
            "email": "manager@example.com",
            "hierarchyLevel": "MANAGER"
          },
          "ipAddress": "127.0.0.1",
          "userAgent": "PostmanRuntime/7.x",
          "createdAt": "2026-03-02T09:30:00.000Z"
        }
      ],
      "total": 1
    }
  }
}
```

**Required Hierarchy**: OWNER  
**Required Permissions**: USERS:READ

---

#### 8.3 Get Resource Audit Logs (Authenticated)
**Purpose**: Retrieve audit logs for a specific resource

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body** (GraphQL):
```graphql
query GetResourceAuditLogs {
  getResourceAuditLogs(
    resourceType: "user"
    resourceId: "{{workerId}}"
  ) {
    logs {
      id
      userId
      organizationId
      hierarchyLevel
      action
      resourceType
      resourceId
      result
      metadata
      oldValue
      newValue
      ipAddress
      userAgent
      createdAt
    }
    total
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "getResourceAuditLogs": {
      "logs": [
        {
          "id": "audit-uuid-1",
          "userId": "manager-uuid",
          "organizationId": "org-uuid",
          "hierarchyLevel": "MANAGER",
          "action": "USER_CREATED",
          "resourceType": "user",
          "resourceId": "worker-uuid",
          "result": "SUCCESS",
          "metadata": {},
          "oldValue": null,
          "newValue": {
            "email": "worker@example.com",
            "hierarchyLevel": "WORKER"
          },
          "ipAddress": "127.0.0.1",
          "userAgent": "PostmanRuntime/7.x",
          "createdAt": "2026-03-02T10:00:00.000Z"
        }
      ],
      "total": 1
    }
  }
}
```

**Required Permissions**: USERS:READ

**Common Resource Types**:
- user
- permission
- branch
- department
- business_rule
- organization


---

### 9. Health Check

#### 9.1 Health Check (Public)
**Purpose**: Check system health status

**Method**: POST  
**URL**: `{{graphqlUrl}}`  
**Headers**:
```
Content-Type: application/json
```

**Body** (GraphQL):
```graphql
query Health {
  health {
    status
    timestamp
    database {
      status
      message
    }
    cache {
      status
      message
    }
    queue {
      status
      message
    }
  }
}
```

**Expected Response**:
```json
{
  "data": {
    "health": {
      "status": "ok",
      "timestamp": "2026-03-02T12:00:00.000Z",
      "database": {
        "status": "up",
        "message": "Database connection is healthy"
      },
      "cache": {
        "status": "up",
        "message": "Redis cache is healthy"
      },
      "queue": {
        "status": "up",
        "message": "Bull queue is healthy"
      }
    }
  }
}
```

**Status Values**:
- `up`: Service is healthy
- `down`: Service is unhealthy
- `degraded`: Service is partially functional

---

## gRPC Endpoints

### Postman Setup for gRPC

**Important**: Postman supports gRPC natively. Follow these steps:

1. Create a new gRPC request in Postman
2. Set server URL: `0.0.0.0:5000`
3. Import proto files from the `proto/` directory
4. For authenticated requests, add metadata:
   - Key: `authorization`
   - Value: `Bearer {{accessToken}}`

### Proto File Locations
```
proto/
├── common/
│   ├── common.proto
│   └── health.proto
└── services/
    ├── authorization.proto
    └── user.proto
```

---

### 1. Health Service (gRPC)

#### 1.1 Check Health
**Service**: `health.HealthService`  
**Method**: `Check`  
**Proto File**: `proto/common/health.proto`

**Request**:
```json
{
  "service": ""
}
```

**Response**:
```json
{
  "status": "SERVING",
  "components": {
    "database": {
      "status": "HEALTHY",
      "message": "Connected",
      "details": {}
    },
    "cache": {
      "status": "HEALTHY",
      "message": "Connected",
      "details": {}
    }
  },
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

**Status Values**:
- `SERVING`: Service is operational
- `NOT_SERVING`: Service is down
- `UNKNOWN`: Status cannot be determined
- `SERVICE_UNKNOWN`: Requested service not found

**Component Status Values**:
- `HEALTHY`: Component is working
- `UNHEALTHY`: Component is down
- `DEGRADED`: Component is partially working
- `UNKNOWN`: Status cannot be determined

---

#### 1.2 Watch Health (Streaming)
**Service**: `health.HealthService`  
**Method**: `Watch`  
**Proto File**: `proto/common/health.proto`

**Request**:
```json
{
  "service": ""
}
```

**Response** (Stream):
```json
{
  "status": "SERVING",
  "components": {
    "database": {
      "status": "HEALTHY",
      "message": "Connected",
      "details": {}
    }
  },
  "timestamp": "2026-03-02T12:00:00.000Z"
}
```

**Notes**: This is a server-streaming RPC that continuously sends health updates


---

### 2. User Service (gRPC)

#### 2.1 Get User
**Service**: `user.UserService`  
**Method**: `GetUser`  
**Proto File**: `proto/services/user.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request**:
```json
{
  "id": "user-uuid-here"
}
```

**Response**:
```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "tenant_id": "org-uuid",
    "created_at": "2026-03-02T10:00:00.000Z",
    "updated_at": "2026-03-02T10:00:00.000Z"
  }
}
```

---

#### 2.2 Get User By Email
**Service**: `user.UserService`  
**Method**: `GetUserByEmail`  
**Proto File**: `proto/services/user.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": true,
    "tenant_id": "org-uuid",
    "created_at": "2026-03-02T10:00:00.000Z",
    "updated_at": "2026-03-02T10:00:00.000Z"
  }
}
```

---

#### 2.3 List Users
**Service**: `user.UserService`  
**Method**: `ListUsers`  
**Proto File**: `proto/services/user.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request**:
```json
{
  "pagination": {
    "page": 1,
    "page_size": 10,
    "sort_by": "created_at",
    "sort_order": "DESC"
  }
}
```

**Response**:
```json
{
  "users": [
    {
      "id": "user-uuid-1",
      "email": "user1@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true,
      "tenant_id": "org-uuid",
      "created_at": "2026-03-02T10:00:00.000Z",
      "updated_at": "2026-03-02T10:00:00.000Z"
    }
  ],
  "meta": {
    "total_count": 1,
    "page": 1,
    "page_size": 10,
    "total_pages": 1
  }
}
```

---

#### 2.4 Create User
**Service**: `user.UserService`  
**Method**: `CreateUser`  
**Proto File**: `proto/services/user.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request**:
```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "tenant_id": "org-uuid"
}
```

**Response**:
```json
{
  "user": {
    "id": "new-user-uuid",
    "email": "newuser@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "is_active": true,
    "tenant_id": "org-uuid",
    "created_at": "2026-03-02T12:00:00.000Z",
    "updated_at": "2026-03-02T12:00:00.000Z"
  }
}
```

---

#### 2.5 Update User
**Service**: `user.UserService`  
**Method**: `UpdateUser`  
**Proto File**: `proto/services/user.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request**:
```json
{
  "id": "user-uuid",
  "email": "updated@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "is_active": true
}
```

**Response**:
```json
{
  "user": {
    "id": "user-uuid",
    "email": "updated@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "is_active": true,
    "tenant_id": "org-uuid",
    "created_at": "2026-03-02T10:00:00.000Z",
    "updated_at": "2026-03-02T12:30:00.000Z"
  }
}
```

---

#### 2.6 Delete User
**Service**: `user.UserService`  
**Method**: `DeleteUser`  
**Proto File**: `proto/services/user.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request**:
```json
{
  "id": "user-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```


---

### 3. Authorization Service (gRPC)

#### 3.1 Check Permission
**Service**: `authorization.AuthorizationService`  
**Method**: `CheckPermission`  
**Proto File**: `proto/services/authorization.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request** (Basic Permission Check):
```json
{
  "user_id": "user-uuid",
  "module": "INVENTORY",
  "action": "CREATE",
  "trace_metadata": {
    "request_id": "req-123",
    "correlation_id": "corr-456"
  }
}
```

**Request** (With Resource Scope):
```json
{
  "user_id": "user-uuid",
  "module": "SALES",
  "action": "CREATE",
  "resource_id": "sale-uuid",
  "resource_scope": {
    "branch_id": "branch-uuid",
    "department_id": "dept-uuid"
  },
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Request** (With Transaction Context for Business Rules):
```json
{
  "user_id": "user-uuid",
  "module": "SALES",
  "action": "CREATE",
  "transaction_context": {
    "transaction_type": "SALE",
    "amount": 15000.00
  },
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Response** (Authorized):
```json
{
  "authorized": true,
  "requires_approval": false,
  "trace_metadata": {
    "request_id": "req-123",
    "correlation_id": "corr-456"
  }
}
```

**Response** (Requires Approval):
```json
{
  "authorized": false,
  "failed_layer": "BUSINESS_RULES",
  "reason": "Transaction amount exceeds threshold for WORKER level",
  "requires_approval": true,
  "approver_level": "MANAGER",
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Response** (Denied):
```json
{
  "authorized": false,
  "failed_layer": "PERMISSION",
  "reason": "User does not have CREATE permission for INVENTORY module",
  "requires_approval": false,
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Authorization Layers**:
1. **HIERARCHY**: Checks user's hierarchy level
2. **PERMISSION**: Checks module-action permissions
3. **SCOPE**: Checks branch/department access
4. **BUSINESS_RULES**: Checks transaction-specific rules

**Hierarchy Levels**:
- `OWNER` (1): Full access
- `MANAGER` (2): Branch/department access
- `WORKER` (3): Limited access

---

#### 3.2 Validate Token
**Service**: `authorization.AuthorizationService`  
**Method**: `ValidateToken`  
**Proto File**: `proto/services/authorization.proto`

**Request**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Response** (Valid Token):
```json
{
  "valid": true,
  "user_identity": {
    "user_id": "user-uuid",
    "organization_id": "org-uuid",
    "hierarchy_level": "MANAGER",
    "branch_id": "branch-uuid",
    "department_id": "dept-uuid",
    "permission_fingerprint": "abc123def456...",
    "email": "user@example.com",
    "issued_at": 1709380800,
    "expires_at": 1709381700
  },
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Response** (Invalid Token):
```json
{
  "valid": false,
  "error_code": "EXPIRED",
  "error_message": "Token has expired",
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Error Codes**:
- `EXPIRED`: Token has expired
- `INVALID_SIGNATURE`: Token signature is invalid
- `BLACKLISTED`: Token has been revoked
- `FINGERPRINT_MISMATCH`: Permission fingerprint doesn't match

---

#### 3.3 Get User Permissions
**Service**: `authorization.AuthorizationService`  
**Method**: `GetUserPermissions`  
**Proto File**: `proto/services/authorization.proto`  
**Authentication**: Required

**Metadata**:
```
authorization: Bearer {{accessToken}}
```

**Request**:
```json
{
  "user_id": "user-uuid",
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```

**Response**:
```json
{
  "permissions": [
    {
      "module": "INVENTORY",
      "actions": ["READ", "CREATE", "UPDATE"]
    },
    {
      "module": "SALES",
      "actions": ["READ", "CREATE"]
    }
  ],
  "permission_fingerprint": "abc123def456...",
  "trace_metadata": {
    "request_id": "req-123"
  }
}
```


---

## Authentication Flow

### Complete Testing Flow

#### Step 1: Register Owner
1. Use `registerOwner` mutation
2. Save `accessToken`, `refreshToken`, `organizationId`, `userId`
3. Owner automatically gets full permissions

#### Step 2: Create Organization Structure
1. Create branches using `createBranch`
2. Create departments using `createDepartment`
3. Create business rules using `createBusinessRule`

#### Step 3: Create Users
1. Owner creates managers using `createManager`
2. Save temporary password from response
3. Manager logs in with temporary password
4. Manager creates workers using `createWorker`
5. Workers can use PIN or password

#### Step 4: Grant Permissions
1. Use `grantPermissions` to assign module permissions
2. Verify with `getUserPermissions`
3. Check permission history with `getPermissionHistory`

#### Step 5: Test Authorization
1. Login as different user types
2. Test scope filtering (managers see only their branch)
3. Test business rules (high-value transactions)
4. Verify audit logs are created

---

## Testing Scenarios

### Scenario 1: Complete Owner Workflow

```graphql
# 1. Register Owner
mutation {
  registerOwner(input: {
    email: "owner@acme.com"
    password: "SecurePass123!"
    firstName: "Alice"
    lastName: "Owner"
    organizationName: "Acme Corp"
    organizationType: "ENTERPRISE"
  }) {
    accessToken
    user { id organizationId }
  }
}

# 2. Create Branch
mutation {
  createBranch(input: {
    organizationId: "{{organizationId}}"
    name: "Main Branch"
    code: "MAIN001"
    address: "123 Main St"
  }) {
    id
  }
}

# 3. Create Manager
mutation {
  createManager(input: {
    email: "manager@acme.com"
    firstName: "Bob"
    lastName: "Manager"
    organizationId: "{{organizationId}}"
    branchId: "{{branchId}}"
    staffProfile: {
      fullName: "Bob Manager"
      positionTitle: "Branch Manager"
      employeeCode: "MGR001"
    }
  }) {
    user { id }
    temporaryCredential
  }
}

# 4. Grant Manager Permissions
mutation {
  grantPermissions(input: {
    userId: "{{managerId}}"
    permissions: [
      { module: "USERS", actions: ["READ", "CREATE", "UPDATE"] }
      { module: "INVENTORY", actions: ["READ", "CREATE", "UPDATE", "DELETE"] }
      { module: "SALES", actions: ["READ", "CREATE", "UPDATE"] }
    ]
  })
}

# 5. View Audit Logs
query {
  getOrganizationAuditLogs(organizationId: "{{organizationId}}") {
    logs {
      action
      resourceType
      result
      createdAt
    }
    total
  }
}
```

---

### Scenario 2: Manager Creates Worker

```graphql
# 1. Manager Login
mutation {
  login(input: {
    email: "manager@acme.com"
    password: "TempPass123!"
    organizationId: "{{organizationId}}"
  }) {
    accessToken
    user { id hierarchyLevel }
  }
}

# 2. Create Worker with PIN
mutation {
  createWorker(input: {
    email: "worker@acme.com"
    firstName: "Charlie"
    lastName: "Worker"
    organizationId: "{{organizationId}}"
    usePIN: true
    staffProfile: {
      fullName: "Charlie Worker"
      positionTitle: "Sales Associate"
      employeeCode: "WRK001"
    }
  }) {
    user { id }
    temporaryCredential
    credentialType
  }
}

# 3. Grant Worker Permissions
mutation {
  grantPermissions(input: {
    userId: "{{workerId}}"
    permissions: [
      { module: "SALES", actions: ["READ", "CREATE"] }
      { module: "INVENTORY", actions: ["READ"] }
    ]
  })
}
```

---

### Scenario 3: Worker Login with PIN

```graphql
# 1. Worker Login with PIN
mutation {
  loginWithPin(input: {
    email: "worker@acme.com"
    pin: "123456"
    organizationId: "{{organizationId}}"
  }) {
    accessToken
    user {
      id
      hierarchyLevel
      branchId
    }
  }
}

# 2. View Own Permissions
query {
  getUserPermissions(userId: "{{workerId}}") {
    permissions {
      module
      actions
    }
  }
}

# 3. View Own Audit Logs
query {
  getUserAuditLogs(userId: "{{workerId}}") {
    logs {
      action
      result
      createdAt
    }
  }
}
```

---

### Scenario 4: Business Rule Testing

```graphql
# 1. Create Business Rule (Owner)
mutation {
  createBusinessRule(input: {
    ruleName: "High Value Sales"
    transactionType: "SALE"
    basedOn: "AMOUNT"
    thresholdValue: 10000.00
    appliesToLevel: "WORKER"
    approverLevel: "MANAGER"
    priority: 1
  }) {
    id
  }
}

# 2. Test via gRPC CheckPermission
# Request with transaction context
{
  "user_id": "worker-uuid",
  "module": "SALES",
  "action": "CREATE",
  "transaction_context": {
    "transaction_type": "SALE",
    "amount": 15000.00
  }
}

# Expected: requires_approval = true, approver_level = MANAGER
```

---

### Scenario 5: Session Management

```graphql
# 1. View Active Sessions
query {
  getActiveSessions {
    id
    ipAddress
    userAgent
    createdAt
    expiresAt
  }
}

# 2. Revoke Specific Session
mutation {
  revokeSession(input: {
    sessionId: "session-uuid"
  })
}

# 3. Revoke All Other Sessions
mutation {
  revokeAllSessions
}

# 4. Change Password (revokes all sessions except current)
mutation {
  changePassword(input: {
    currentPassword: "OldPass123!"
    newPassword: "NewPass456!"
  })
}
```


---

## Common Error Responses

### GraphQL Errors

#### Authentication Error
```json
{
  "errors": [
    {
      "message": "Unauthorized",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

#### Permission Denied
```json
{
  "errors": [
    {
      "message": "Insufficient permissions",
      "extensions": {
        "code": "FORBIDDEN",
        "requiredPermission": "USERS:CREATE"
      }
    }
  ]
}
```

#### Validation Error
```json
{
  "errors": [
    {
      "message": "Validation failed",
      "extensions": {
        "code": "BAD_USER_INPUT",
        "validationErrors": [
          {
            "field": "email",
            "message": "Invalid email format"
          }
        ]
      }
    }
  ]
}
```

#### Hierarchy Level Error
```json
{
  "errors": [
    {
      "message": "Insufficient hierarchy level",
      "extensions": {
        "code": "FORBIDDEN",
        "requiredLevel": "OWNER",
        "currentLevel": "MANAGER"
      }
    }
  ]
}
```

#### Rate Limit Error
```json
{
  "errors": [
    {
      "message": "Too many requests",
      "extensions": {
        "code": "RATE_LIMIT_EXCEEDED",
        "retryAfter": 900
      }
    }
  ]
}
```

---

### gRPC Errors

#### UNAUTHENTICATED (16)
```json
{
  "code": 16,
  "message": "Invalid or expired token",
  "details": []
}
```

#### PERMISSION_DENIED (7)
```json
{
  "code": 7,
  "message": "User does not have required permissions",
  "details": []
}
```

#### INVALID_ARGUMENT (3)
```json
{
  "code": 3,
  "message": "Invalid input: email is required",
  "details": []
}
```

#### NOT_FOUND (5)
```json
{
  "code": 5,
  "message": "User not found",
  "details": []
}
```

#### ALREADY_EXISTS (6)
```json
{
  "code": 6,
  "message": "User with this email already exists",
  "details": []
}
```

---

## Environment Variables for Postman

Create a Postman environment with these variables:

```json
{
  "name": "ERP System - Development",
  "values": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3001",
      "enabled": true
    },
    {
      "key": "graphqlUrl",
      "value": "{{baseUrl}}/graphql",
      "enabled": true
    },
    {
      "key": "grpcUrl",
      "value": "0.0.0.0:5000",
      "enabled": true
    },
    {
      "key": "accessToken",
      "value": "",
      "enabled": true
    },
    {
      "key": "refreshToken",
      "value": "",
      "enabled": true
    },
    {
      "key": "organizationId",
      "value": "",
      "enabled": true
    },
    {
      "key": "userId",
      "value": "",
      "enabled": true
    },
    {
      "key": "managerId",
      "value": "",
      "enabled": true
    },
    {
      "key": "workerId",
      "value": "",
      "enabled": true
    },
    {
      "key": "branchId",
      "value": "",
      "enabled": true
    },
    {
      "key": "departmentId",
      "value": "",
      "enabled": true
    },
    {
      "key": "ruleId",
      "value": "",
      "enabled": true
    }
  ]
}
```

---

## Testing Checklist

### Authentication & Authorization
- [ ] Register owner successfully
- [ ] Login with password
- [ ] Login with PIN (worker)
- [ ] Refresh token
- [ ] Logout
- [ ] Change password
- [ ] View active sessions
- [ ] Revoke specific session
- [ ] Revoke all sessions
- [ ] Test rate limiting (5 failed logins)

### User Management
- [ ] Owner creates manager
- [ ] Manager creates worker
- [ ] Create worker with PIN
- [ ] Create worker with password
- [ ] Update user details
- [ ] Get user by ID
- [ ] Get users list
- [ ] Verify scope filtering (manager sees only their branch)

### Organization Structure
- [ ] Get organization details
- [ ] Update organization (owner only)
- [ ] Create branch
- [ ] Update branch
- [ ] Get branches list
- [ ] Assign branch manager
- [ ] Create department
- [ ] Update department
- [ ] Get departments list
- [ ] Assign department manager

### Permissions
- [ ] Grant permissions to user
- [ ] Revoke permissions from user
- [ ] Get user permissions
- [ ] Get permission history
- [ ] Verify permission fingerprint changes

### Business Rules
- [ ] Create business rule
- [ ] Update business rule
- [ ] Get business rules (all)
- [ ] Get business rules (filtered by transaction type)
- [ ] Test rule evaluation via gRPC CheckPermission

### Audit Logs
- [ ] Get user audit logs
- [ ] Get organization audit logs (owner only)
- [ ] Get resource audit logs
- [ ] Filter by date range
- [ ] Filter by action type
- [ ] Filter by resource type

### Health Checks
- [ ] GraphQL health check
- [ ] gRPC health check
- [ ] gRPC health watch (streaming)

### gRPC Services
- [ ] Get user by ID
- [ ] Get user by email
- [ ] List users with pagination
- [ ] Create user
- [ ] Update user
- [ ] Delete user
- [ ] Check permission (basic)
- [ ] Check permission (with scope)
- [ ] Check permission (with business rules)
- [ ] Validate token
- [ ] Get user permissions

### Error Handling
- [ ] Test invalid credentials
- [ ] Test expired token
- [ ] Test insufficient permissions
- [ ] Test invalid hierarchy level
- [ ] Test validation errors
- [ ] Test duplicate email
- [ ] Test invalid organization ID
- [ ] Test rate limiting

---

## Tips for Testing

1. **Start Fresh**: Use `registerOwner` to create a new organization for each test run

2. **Save Tokens**: Always save tokens from login/register responses using post-request scripts

3. **Test Hierarchy**: 
   - Login as owner to test full access
   - Login as manager to test branch-level access
   - Login as worker to test limited access

4. **Verify Audit Logs**: After each operation, check audit logs to ensure tracking works

5. **Test Scope Filtering**: 
   - Create users in different branches
   - Login as manager and verify they only see their branch users

6. **Business Rules**: 
   - Create rules with different thresholds
   - Test transactions above and below thresholds
   - Verify approval requirements

7. **Session Management**: 
   - Login from multiple "devices" (different user agents)
   - Test session revocation
   - Verify token expiration

8. **Error Cases**: 
   - Test with invalid data
   - Test with missing required fields
   - Test with wrong hierarchy level
   - Test with revoked tokens

9. **gRPC Testing**: 
   - Import all proto files in Postman
   - Use metadata for authentication
   - Test streaming endpoints

10. **Performance**: 
    - Test pagination with large datasets
    - Test concurrent requests
    - Monitor response times

---

## Troubleshooting

### Issue: "Unauthorized" error
**Solution**: Ensure `Authorization: Bearer {{accessToken}}` header is set and token is valid

### Issue: "Insufficient permissions"
**Solution**: Grant required permissions using `grantPermissions` mutation

### Issue: "Insufficient hierarchy level"
**Solution**: Login with a user that has the required hierarchy level (OWNER/MANAGER)

### Issue: Token expired
**Solution**: Use `refreshToken` mutation to get a new access token

### Issue: Rate limit exceeded
**Solution**: Wait 15 minutes or use a different IP address

### Issue: gRPC connection refused
**Solution**: Ensure server is running on port 5000 and gRPC is enabled

### Issue: Validation errors
**Solution**: Check input format matches the schema (email format, password requirements, etc.)

### Issue: Scope filtering not working
**Solution**: Ensure user has branchId/departmentId set and is not OWNER level

---

## Summary

This guide covers:
- **39 GraphQL endpoints** (9 auth, 5 user management, 2 organization, 8 branch/department, 4 permissions, 3 business rules, 3 audit, 1 health)
- **10 gRPC endpoints** (2 health, 6 user service, 3 authorization service)
- Complete authentication flows
- Permission and authorization testing
- Business rule evaluation
- Audit log verification
- Error handling scenarios

All endpoints are documented with:
- Exact request/response formats
- Required headers and authentication
- Permission requirements
- Validation rules
- Post-request scripts for automation
- Common error responses

Use this guide to systematically test every endpoint in the ERP system.
