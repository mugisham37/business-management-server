import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DatabaseModule } from '../../core/database/database.module';
import { CacheModule } from '../../core/cache/cache.module';
import { AuthModule } from '../../core/auth/auth.module';
import { HealthModule } from '../../health/health.module';
import { UserModule } from '../../modules/user/user.module';
import { HealthResolver } from './resolvers/health.resolver';
import { UserResolver } from './resolvers/user.resolver';

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
          message: error.message,
          code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
          path: error.path,
          timestamp: new Date().toISOString(),
        };
      },
      context: ({ req }: { req: any }) => ({ req }),
    }),
    DatabaseModule,
    CacheModule,
    AuthModule,
    HealthModule,
    UserModule,
  ],
  providers: [HealthResolver, UserResolver],
  exports: [],
})
export class GraphQLModule {}
