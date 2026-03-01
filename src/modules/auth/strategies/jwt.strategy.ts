import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../token.service';
import { UserContext } from '../../../common/types/user-context.type';

/**
 * JWT Strategy for Passport
 * Validates JWT tokens and extracts user context
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: false,
    });
  }

  /**
   * Validate JWT payload and check token blacklist
   * This method is called after JWT signature verification
   */
  async validate(payload: any): Promise<UserContext> {
    // Verify token is not blacklisted
    const isBlacklisted = await this.tokenService.isTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // Verify permission fingerprint matches current permissions
    const isValid = await this.tokenService.verifyPermissionFingerprint(
      payload.userId,
      payload.permissionFingerprint,
    );
    if (!isValid) {
      throw new UnauthorizedException('Permission fingerprint mismatch - please re-authenticate');
    }

    // Return user context to be attached to request
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      hierarchyLevel: payload.hierarchyLevel,
      branchId: payload.branchId,
      departmentId: payload.departmentId,
      permissionFingerprint: payload.permissionFingerprint,
      email: payload.email,
    };
  }
}
