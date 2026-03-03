import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DatabaseModule } from '../../core/database/database.module';
import { HealthModule } from '../../health/health.module';
import { UserModule } from '../../modules/user/user.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { AuthorizationModule } from '../../modules/authorization/authorization.module';
import { PermissionModule } from '../../modules/permission/permission.module';
import { OrganizationModule } from '../../modules/organization/organization.module';
import { AuditModule } from '../../modules/audit/audit.module';
import { HealthResolver } from './resolvers/health.resolver';
import { UserResolver } from './resolvers/user.resolver';
import { AuthResolver } from './resolvers/auth.resolver';
import { PermissionResolver } from './resolvers/permission.resolver';
import { OrganizationResolver } from './resolvers/organization.resolver';
import { BranchResolver } from './resolvers/branch.resolver';
import { DepartmentResolver } from './resolvers/department.resolver';
import { BusinessRuleResolver } from './resolvers/business-rule.resolver';
import { AuditResolver } from './resolvers/audit.resolver';

@Module({
  imports: [
    NestGraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/api/graphql/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      formatError: (error) => {
        return {
          message: error?.message || 'An error occurred',
          code: error?.extensions?.code || 'INTERNAL_SERVER_ERROR',
          path: error?.path || [],
          timestamp: new Date().toISOString(),
        };
      },
      context: ({ req }: { req: any }) => ({ req }),
    }),
    DatabaseModule,
    HealthModule,
    UserModule,
    AuthModule,
    AuthorizationModule,
    PermissionModule,
    OrganizationModule,
    AuditModule,
  ],
  providers: [
    HealthResolver,
    UserResolver,
    AuthResolver,
    PermissionResolver,
    OrganizationResolver,
    BranchResolver,
    DepartmentResolver,
    BusinessRuleResolver,
    AuditResolver,
  ],
  exports: [],
})
export class GraphQLModule {}
