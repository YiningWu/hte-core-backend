import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { FastifyRequest, FastifyReply } from 'fastify';
import * as opentelemetry from '@opentelemetry/api';

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TracingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<FastifyRequest>();
    const response = httpContext.getResponse<FastifyReply>();
    const handler = context.getHandler();
    const controller = context.getClass();

    // Extract trace context from headers
    const activeContext = opentelemetry.propagation.extract(
      opentelemetry.context.active(),
      request.headers
    );

    const tracer = opentelemetry.trace.getTracer('eduhub-http', '1.0.0');
    
    // Create span for HTTP request
    const span = tracer.startSpan(
      `${request.method} ${request.url}`,
      {
        kind: opentelemetry.SpanKind.SERVER,
        attributes: {
          'http.method': request.method,
          'http.url': request.url,
          'http.route': this.extractRoute(request),
          'http.scheme': request.protocol,
          'http.host': request.hostname,
          'http.user_agent': request.headers['user-agent'],
          'http.remote_addr': this.getClientIP(request),
          'controller.name': controller.name,
          'handler.name': handler.name,
          'component': 'http-server',
        },
      },
      activeContext
    );

    // Add correlation IDs if present
    const correlationId = request.headers['x-correlation-id'] as string;
    const requestId = request.headers['x-request-id'] as string;
    
    if (correlationId) {
      span.setAttribute('correlation.id', correlationId);
    }
    if (requestId) {
      span.setAttribute('request.id', requestId);
    }

    // Add user context if available (from JWT or session)
    if (request.user) {
      span.setAttributes({
        'user.id': (request.user as any).userId,
        'user.org_id': (request.user as any).orgId,
        'user.authenticated': true,
      });
    }

    const startTime = Date.now();

    return opentelemetry.context.with(
      opentelemetry.trace.setSpan(activeContext, span),
      () =>
        next.handle().pipe(
          tap((data) => {
            const duration = Date.now() - startTime;
            
            // Add response information
            span.setAttributes({
              'http.status_code': response.statusCode,
              'http.response.size': this.getResponseSize(data),
              'http.response.duration_ms': duration,
            });

            // Add response type information
            if (data) {
              if (Array.isArray(data)) {
                span.setAttribute('http.response.type', 'array');
                span.setAttribute('http.response.items_count', data.length);
              } else if (typeof data === 'object') {
                span.setAttribute('http.response.type', 'object');
                
                // Add common response properties
                if (data.success !== undefined) {
                  span.setAttribute('http.response.success', data.success);
                }
                if (data.total !== undefined) {
                  span.setAttribute('http.response.total', data.total);
                }
                if (data.items && Array.isArray(data.items)) {
                  span.setAttribute('http.response.items_count', data.items.length);
                }
              } else {
                span.setAttribute('http.response.type', typeof data);
              }
            }

            // Set performance category
            if (duration < 100) {
              span.setAttribute('performance.category', 'fast');
            } else if (duration < 1000) {
              span.setAttribute('performance.category', 'medium');
            } else {
              span.setAttribute('performance.category', 'slow');
            }

            span.setStatus({ code: opentelemetry.SpanStatusCode.OK });
            
            // Add trace metadata to response headers for debugging
            if (process.env.NODE_ENV === 'development') {
              const spanContext = span.spanContext();
              response.header('x-trace-id', spanContext.traceId);
              response.header('x-span-id', spanContext.spanId);
            }
          }),
          catchError((error) => {
            const duration = Date.now() - startTime;

            // Record error information
            span.setStatus({
              code: opentelemetry.SpanStatusCode.ERROR,
              message: error.message,
            });

            span.recordException(error);

            // Add error attributes
            span.setAttributes({
              'error.type': error.constructor.name,
              'error.message': error.message,
              'http.status_code': error.status || 500,
              'http.response.duration_ms': duration,
            });

            // Add stack trace for debugging (be careful with sensitive data)
            if (process.env.NODE_ENV === 'development' && error.stack) {
              span.setAttribute('error.stack', error.stack.substring(0, 1000));
            }

            throw error;
          }),
          tap({
            complete: () => span.end(),
            error: () => span.end(),
          })
        )
    );
  }

  private extractRoute(request: FastifyRequest): string {
    // Try to extract route pattern from Fastify
    if (request.routerPath) {
      return request.routerPath;
    }
    
    // Fallback: clean URL path
    return request.url.split('?')[0];
  }

  private getClientIP(request: FastifyRequest): string {
    const xForwardedFor = request.headers['x-forwarded-for'] as string;
    const xRealIP = request.headers['x-real-ip'] as string;
    
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }
    
    if (xRealIP) {
      return xRealIP;
    }
    
    return request.ip || 'unknown';
  }

  private getResponseSize(data: any): number {
    if (!data) return 0;
    
    try {
      if (typeof data === 'string') {
        return Buffer.byteLength(data, 'utf8');
      }
      
      if (typeof data === 'object') {
        return Buffer.byteLength(JSON.stringify(data), 'utf8');
      }
      
      return Buffer.byteLength(String(data), 'utf8');
    } catch {
      return 0;
    }
  }
}