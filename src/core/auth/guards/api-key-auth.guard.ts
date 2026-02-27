import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * API Key Authentication Guard
 * Protects endpoints by requiring valid API key
 */
@Injectable()
export class ApiKeyAuthGuard extends AuthGuard('api-key') {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }
}
