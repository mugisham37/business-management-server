import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { ApiKeyService } from './api-key.service';
import { JwtStrategy } from './jwt.strategy';
import { ApiKeyStrategy } from './api-key.strategy';
import { DatabaseModule } from '../database/database.module';
import { CacheModule } from '../cache/cache.module';
import { AppConfig } from '../config/configuration';

/**
 * Authentication Module
 * Provides JWT-based authentication and authorization infrastructure
 */
@Module({
  imports: [
    DatabaseModule,
    CacheModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig>) => ({
        secret: configService.get('auth.jwtSecret', { infer: true }),
        signOptions: {
          expiresIn: configService.get('auth.jwtExpiresIn', { infer: true }),
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    SessionService,
    ApiKeyService,
    JwtStrategy,
    ApiKeyStrategy,
  ],
  exports: [
    AuthService,
    SessionService,
    ApiKeyService,
    PassportModule,
    JwtModule,
  ],
})
export class AuthModule {}
