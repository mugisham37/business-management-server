import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { JwtPayload, UserContext } from './interfaces';
import { AppConfig } from '../config/configuration';

/**
 * JWT Strategy
 * Validates JWT tokens and extracts user context
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService<AppConfig>,
    private readonly authService: AuthService,
  ) {
    const jwtSecret = configService.get('auth.jwtSecret', { infer: true });
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validate JWT payload and return user context
   * @param payload JWT payload
   * @returns User context
   */
  async validate(payload: JwtPayload): Promise<UserContext> {
    try {
      return await this.authService.validateUser(payload);
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
