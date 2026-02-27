import { Catch, ArgumentsHost, Logger } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

/**
 * GraphQL Exception Filter
 * Formats errors for GraphQL protocol
 */
@Catch()
export class GraphQLExceptionFilter implements GqlExceptionFilter {
  private readonly logger = new Logger(GraphQLExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const info = gqlHost.getInfo();

    this.logger.error(
      `GraphQL Error in ${info.fieldName}: ${exception.message}`,
      exception.stack,
    );

    // Map common error types to GraphQL error codes
    const errorCode = this.getErrorCode(exception);
    const message = exception.message || 'Internal server error';

    return new GraphQLError(message, {
      extensions: {
        code: errorCode,
        timestamp: new Date().toISOString(),
        path: info.path,
      },
    });
  }

  private getErrorCode(exception: any): string {
    const statusCode = exception.status || exception.statusCode;

    switch (statusCode) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHENTICATED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      default:
        return 'INTERNAL_SERVER_ERROR';
    }
  }
}
