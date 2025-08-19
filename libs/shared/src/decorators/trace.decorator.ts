import { Logger } from '@nestjs/common';
import * as opentelemetry from '@opentelemetry/api';

const logger = new Logger('TraceDecorator');

/**
 * Decorator to automatically trace method execution
 */
export function Trace(spanName?: string, attributes?: Record<string, string | number | boolean>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;
    const defaultSpanName = spanName || `${className}.${methodName}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = opentelemetry.trace.getTracer('eduhub', '1.0.0');
      const span = tracer.startSpan(defaultSpanName, {
        attributes: {
          'code.function': methodName,
          'code.namespace': className,
          'component': 'application',
          ...attributes,
        },
      });

      try {
        // Add method arguments as attributes (be careful with sensitive data)
        if (args.length > 0 && process.env.TRACING_INCLUDE_ARGS === 'true') {
          span.setAttributes({
            'method.args.count': args.length,
          });

          // Only add safe arguments (non-sensitive data)
          args.forEach((arg, index) => {
            if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
              span.setAttribute(`method.args.${index}`, String(arg).substring(0, 100));
            } else if (arg && typeof arg === 'object' && arg.id) {
              span.setAttribute(`method.args.${index}.id`, String(arg.id));
            }
          });
        }

        const result = await opentelemetry.context.with(
          opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
          () => originalMethod.apply(this, args)
        );

        // Add result information if it's a simple type
        if (result !== null && result !== undefined) {
          if (typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean') {
            span.setAttribute('method.result', String(result).substring(0, 100));
          } else if (Array.isArray(result)) {
            span.setAttribute('method.result.length', result.length);
          } else if (result && typeof result === 'object') {
            if (result.id) {
              span.setAttribute('method.result.id', String(result.id));
            }
            if (result.length !== undefined) {
              span.setAttribute('method.result.length', result.length);
            }
          }
        }

        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        
        // Add error context
        span.setAttributes({
          'error.type': error.constructor.name,
          'error.message': error.message,
        });

        throw error;
      } finally {
        span.end();
      }
    };

    // Handle synchronous methods
    if (originalMethod.constructor.name !== 'AsyncFunction' && originalMethod.constructor.name !== 'Function') {
      descriptor.value = function (...args: any[]) {
        const tracer = opentelemetry.trace.getTracer('eduhub', '1.0.0');
        const span = tracer.startSpan(defaultSpanName, {
          attributes: {
            'code.function': methodName,
            'code.namespace': className,
            'component': 'application',
            'method.sync': true,
            ...attributes,
          },
        });

        try {
          const result = opentelemetry.context.with(
            opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
            () => originalMethod.apply(this, args)
          );

          span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: opentelemetry.SpanStatusCode.ERROR,
            message: error.message,
          });
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      };
    }

    return descriptor;
  };
}

/**
 * Class decorator to trace all methods of a class
 */
export function TraceClass(spanPrefix?: string) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const className = constructor.name;
    const prefix = spanPrefix || className.toLowerCase();

    // Get all method names
    const methodNames = Object.getOwnPropertyNames(constructor.prototype).filter(
      (name) => name !== 'constructor' && typeof constructor.prototype[name] === 'function'
    );

    // Apply Trace decorator to each method
    methodNames.forEach((methodName) => {
      const descriptor = Object.getOwnPropertyDescriptor(constructor.prototype, methodName);
      if (descriptor && typeof descriptor.value === 'function') {
        const tracedDescriptor = Trace(`${prefix}.${methodName}`)(
          constructor.prototype,
          methodName,
          descriptor
        );
        Object.defineProperty(constructor.prototype, methodName, tracedDescriptor);
      }
    });

    return constructor;
  };
}

/**
 * Decorator specifically for database operations
 */
export function TraceDatabase(operation?: string, entity?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;
    const dbOperation = operation || methodName;
    const spanName = `db.${dbOperation}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = opentelemetry.trace.getTracer('eduhub', '1.0.0');
      const span = tracer.startSpan(spanName, {
        attributes: {
          'db.system': 'mysql',
          'db.operation': dbOperation,
          'db.entity': entity || 'unknown',
          'component': 'database',
          'code.function': methodName,
          'code.namespace': className,
        },
      });

      try {
        // Add entity ID if available in arguments
        const entityId = args.find(arg => 
          typeof arg === 'number' || 
          (typeof arg === 'object' && arg && (arg.id || arg.user_id || arg.campus_id))
        );

        if (entityId) {
          if (typeof entityId === 'number') {
            span.setAttribute('db.entity.id', entityId);
          } else if (entityId.id) {
            span.setAttribute('db.entity.id', entityId.id);
          } else if (entityId.user_id) {
            span.setAttribute('db.entity.user_id', entityId.user_id);
          } else if (entityId.campus_id) {
            span.setAttribute('db.entity.campus_id', entityId.campus_id);
          }
        }

        const result = await opentelemetry.context.with(
          opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
          () => originalMethod.apply(this, args)
        );

        // Add result metrics for database operations
        if (Array.isArray(result)) {
          span.setAttribute('db.rows_affected', result.length);
        } else if (result && typeof result === 'object' && result.affected !== undefined) {
          span.setAttribute('db.rows_affected', result.affected);
        }

        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        
        span.setAttributes({
          'db.error': true,
          'error.type': error.constructor.name,
        });

        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}

/**
 * Decorator for HTTP/API endpoints
 */
export function TraceEndpoint(operation?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;
    const methodName = propertyKey;
    const httpOperation = operation || methodName;
    const spanName = `http.${httpOperation}`;

    descriptor.value = async function (...args: any[]) {
      const tracer = opentelemetry.trace.getTracer('eduhub', '1.0.0');
      const span = tracer.startSpan(spanName, {
        attributes: {
          'http.operation': httpOperation,
          'component': 'http-handler',
          'code.function': methodName,
          'code.namespace': className,
        },
      });

      try {
        // Extract user context from arguments if available
        const userContext = args.find(arg => 
          arg && typeof arg === 'object' && (arg.user || arg.userId || arg.orgId)
        );

        if (userContext) {
          if (userContext.user) {
            span.setAttributes({
              'user.id': userContext.user.userId,
              'user.org_id': userContext.user.orgId,
            });
          } else {
            if (userContext.userId) span.setAttribute('user.id', userContext.userId);
            if (userContext.orgId) span.setAttribute('user.org_id', userContext.orgId);
          }
        }

        const result = await opentelemetry.context.with(
          opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
          () => originalMethod.apply(this, args)
        );

        // Add response information
        if (result && typeof result === 'object') {
          if (result.statusCode) {
            span.setAttribute('http.status_code', result.statusCode);
          }
          if (result.data && Array.isArray(result.data)) {
            span.setAttribute('http.response.items_count', result.data.length);
          }
        }

        span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: opentelemetry.SpanStatusCode.ERROR,
          message: error.message,
        });
        span.recordException(error);
        
        // Map HTTP error status codes
        let httpStatusCode = 500;
        if (error.status) {
          httpStatusCode = error.status;
        } else if (error.message.includes('NotFound')) {
          httpStatusCode = 404;
        } else if (error.message.includes('Conflict')) {
          httpStatusCode = 409;
        } else if (error.message.includes('BadRequest')) {
          httpStatusCode = 400;
        } else if (error.message.includes('Unauthorized')) {
          httpStatusCode = 401;
        } else if (error.message.includes('Forbidden')) {
          httpStatusCode = 403;
        }

        span.setAttributes({
          'http.status_code': httpStatusCode,
          'error.type': error.constructor.name,
        });

        throw error;
      } finally {
        span.end();
      }
    };

    return descriptor;
  };
}