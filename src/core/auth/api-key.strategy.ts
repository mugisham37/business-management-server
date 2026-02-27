import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-http-bearer';
import { ApiKeyService } from './api-key.service';

/**
 * API Key Strategy
 * Validates API keys from request headers using Bearer token strategy
 */
@Injectable()
export class ApiKeyStrategy extends PassportStrategy(Strategy, 'api-key') {
  constructor(private readonly apiKeyService: ApiKeyService) {
    super();
  }

  /**
   * Validate API key from bearer token
   * @param token API key token
   * @returns Validation result
   */
  async validate(token: string): Promise<any> {
    if (!token) {
      throw new UnauthorizedException('API key is missing');
    }

    const isValid = await this.apiKeyService.validateApiKey(token);

    if (!isValid) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Return a service context for API key authentication
    return {
      type: 'api-key',
      authenticated: true,
    };
  }
}
