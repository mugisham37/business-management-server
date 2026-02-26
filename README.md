# NestJS ERP Infrastructure

This is the backend infrastructure for the ERP system built with NestJS. This phase focuses exclusively on establishing the foundational infrastructure without implementing business modules.

## Project Structure

```
server/
├── src/
│   ├── core/              # Core infrastructure modules
│   │   ├── database/      # Prisma ORM and repository pattern
│   │   ├── cache/         # Redis caching layer
│   │   ├── queue/         # Bull queue system
│   │   ├── events/        # Event-driven architecture
│   │   ├── config/        # Configuration management
│   │   ├── auth/          # Authentication & authorization
│   │   └── logging/       # Structured logging
│   ├── shared/            # Shared utilities and DTOs
│   ├── api/               # API layer (gRPC & GraphQL)
│   ├── health/            # Health check endpoints
│   └── test/              # Test utilities and helpers
├── prisma/                # Database schema and migrations
├── proto/                 # gRPC Protocol Buffer definitions
├── docker/                # Docker configuration
└── test/                  # Integration tests
```

## Technology Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x (strict mode)
- **Database**: PostgreSQL 15.x with Prisma 5.x ORM
- **Cache**: Redis 7.x
- **Queue**: Bull 4.x
- **Events**: EventEmitter2 6.x
- **APIs**: GraphQL (Apollo) & gRPC
- **Testing**: Jest 29.x with fast-check for property-based testing

## Prerequisites

- Node.js 20.x LTS
- PostgreSQL 15.x
- Redis 7.x
- Docker & Docker Compose (for containerized development)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure your environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your local configuration.

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database
npm run prisma:seed
```

### 4. Start Development Server

```bash
npm run start:dev
```

The application will be available at:
- REST API: http://localhost:3000
- GraphQL Playground: http://localhost:3000/graphql
- gRPC: localhost:5000

## Available Scripts

### Development
- `npm run start:dev` - Start development server with hot-reload
- `npm run start:debug` - Start development server with debugger
- `npm run build` - Build production bundle
- `npm run start:prod` - Start production server

### Code Quality
- `npm run lint` - Lint and fix code
- `npm run lint:check` - Check linting without fixing
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check formatting without fixing
- `npm run type-check` - Run TypeScript type checking

### Testing
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:cov` - Run tests with coverage
- `npm run test:property` - Run property-based tests
- `npm run test:e2e` - Run end-to-end tests

### Database
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Create and apply migration
- `npm run prisma:migrate:deploy` - Apply migrations (production)
- `npm run prisma:studio` - Open Prisma Studio GUI
- `npm run prisma:seed` - Seed database with initial data

### Code Generation
- `npm run proto:generate` - Generate gRPC code from proto files

## Docker Development

Start all services with Docker Compose:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- Redis cache/queue
- NestJS application

## Architecture Principles

1. **Type Safety First**: Leverage TypeScript's type system throughout
2. **Separation of Concerns**: Clear boundaries between infrastructure and business logic
3. **Testability**: All components designed for easy testing
4. **Observability**: Comprehensive logging, monitoring, and health checks
5. **Scalability**: Connection pooling, caching, and async processing
6. **Security**: Authentication, authorization, and input validation at all layers

## Key Features

### Database Layer
- Prisma ORM with type-safe queries
- Repository pattern for data access
- Soft deletes and audit logging
- Multi-tenant isolation
- Transaction support

### Cache Layer
- Redis-based caching
- Multi-tier caching (memory + Redis)
- Cache-aside, write-through, and write-behind strategies
- Event-based cache invalidation
- Hierarchical cache keys

### Queue System
- Bull queue for background jobs
- Multiple named queues
- Job retry with exponential backoff
- Priority levels
- Dead letter queue
- Bull Board dashboard

### Event System
- EventEmitter2 for domain events
- Wildcard event matching
- Async event handlers
- Event logging and replay
- Cross-module communication

### API Layer
- Dual protocol support (gRPC & GraphQL)
- Shared service layer
- Authentication and authorization
- Request validation
- Error handling

### Configuration
- Environment-based configuration
- Validation on startup
- Type-safe configuration access
- Sensitive value masking

### Logging
- Structured JSON logging
- Correlation ID tracking
- Request/response logging
- Database query logging
- Cache operation logging

## Testing Strategy

The project uses a dual testing approach:

### Unit Tests
- Specific examples and edge cases
- Mock-based isolation
- Fast execution

### Property-Based Tests
- Universal properties across all inputs
- Comprehensive input coverage
- Invariant validation
- Minimum 100 iterations per property

## Health Checks

Health check endpoints are available at:
- `/health` - Overall health status
- `/health/live` - Liveness probe
- `/health/ready` - Readiness probe

## Documentation

- API documentation available at `/api/docs` (Swagger)
- GraphQL schema available at `/graphql` (Playground)
- Architecture Decision Records in `/docs/adr`

## Contributing

1. Follow the existing code structure and patterns
2. Write tests for all new functionality
3. Ensure all tests pass before committing
4. Run linting and formatting before committing
5. Update documentation as needed

## License

UNLICENSED - Private project
