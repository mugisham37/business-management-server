import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { AuthService } from './auth.service';
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
  providers: [TokenService, SessionService, AuthService],
  exports: [TokenService, SessionService, AuthService],
})
export class AuthModule {}
