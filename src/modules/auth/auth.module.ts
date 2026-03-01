import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { CacheModule } from '../../core/cache/cache.module';
import { DatabaseModule } from '../../core/database/database.module';
import { LoggingModule } from '../../core/logging/logging.module';

/**
 * Auth module handling authentication, token management, and session lifecycle
 */
@Module({
  imports: [
    ConfigModule,
    CacheModule,
    DatabaseModule,
    LoggingModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<number>('JWT_ACCESS_TOKEN_EXPIRY_SECONDS') || 900,
        },
      }),
    }),
  ],
  providers: [
    TokenService,
    SessionService,
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RateLimitGuard,
  ],
  exports: [
    TokenService,
    SessionService,
    AuthService,
    JwtAuthGuard,
    RateLimitGuard,
  ],
})
export class AuthModule {}
