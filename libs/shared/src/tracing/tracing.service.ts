import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { BatchSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { FastifyInstrumentation } from '@opentelemetry/instrumentation-fastify';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { MySQLInstrumentation } from '@opentelemetry/instrumentation-mysql2';
import { TypeOrmInstrumentation } from 'opentelemetry-instrumentation-typeorm';
import * as opentelemetry from '@opentelemetry/api';

export interface TraceOptions {
  name: string;
  attributes?: Record<string, string | number | boolean>;
  parentSpan?: opentelemetry.Span;
}

export interface TraceMetadata {
  traceId: string;
  spanId: string;
  flags: string;
}

@Injectable()
export class TracingService implements OnModuleInit {
  private readonly logger = new Logger(TracingService.name);
  private sdk: NodeSDK;
  private tracer: opentelemetry.Tracer;
  private readonly serviceName: string;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    this.serviceName = this.configService.get('SERVICE_NAME', 'eduhub-service');
    this.environment = this.configService.get('NODE_ENV', 'development');
  }

  async onModuleInit() {
    if (this.configService.get('TRACING_ENABLED', 'false') === 'true') {
      await this.initializeTracing();
    } else {
      this.logger.log('OpenTelemetry tracing is disabled');
    }
  }

  private async initializeTracing() {
    try {
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: this.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: this.configService.get('SERVICE_VERSION', '1.0.0'),
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: this.environment,
        [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'eduhub',
        [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.HOSTNAME || 'unknown',
      });

      // Configure exporters
      const exporters = this.createExporters();

      // Configure instrumentation
      const instrumentations = [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false }, // Disable noisy fs instrumentation
          '@opentelemetry/instrumentation-dns': { enabled: false },
        }),
        new HttpInstrumentation({
          requestHook: (span, request) => {
            span.setAttributes({
              'http.request.header.user-agent': request.headers['user-agent'],
              'http.request.header.x-forwarded-for': request.headers['x-forwarded-for'],
              'custom.service_name': this.serviceName,
            });
          },
          responseHook: (span, response) => {
            span.setAttributes({
              'http.response.status_class': this.getStatusClass(response.statusCode),
            });
          },
        }),
        new ExpressInstrumentation(),
        new FastifyInstrumentation(),
        new RedisInstrumentation({
          dbStatementSerializer: (cmdName, cmdArgs) => {
            return `${cmdName} ${cmdArgs.slice(0, 2).join(' ')}${cmdArgs.length > 2 ? '...' : ''}`;
          },
        }),
        new IORedisInstrumentation(),
        new MySQLInstrumentation(),
        new TypeOrmInstrumentation(),
      ];

      // Initialize SDK
      this.sdk = new NodeSDK({
        resource,
        spanProcessors: exporters.map(exporter => new BatchSpanProcessor(exporter)),
        instrumentations,
      });

      this.sdk.start();
      
      // Get tracer instance
      this.tracer = opentelemetry.trace.getTracer(this.serviceName, '1.0.0');

      this.logger.log(`OpenTelemetry tracing initialized for service: ${this.serviceName}`);
    } catch (error) {
      this.logger.error(`Failed to initialize OpenTelemetry tracing: ${error.message}`, error.stack);
    }
  }

  private createExporters() {
    const exporters = [];
    
    // Console exporter for development
    if (this.environment === 'development') {
      exporters.push(new ConsoleSpanExporter());
    }

    // Jaeger exporter
    const jaegerEndpoint = this.configService.get('JAEGER_ENDPOINT');
    if (jaegerEndpoint) {
      exporters.push(new JaegerExporter({
        endpoint: jaegerEndpoint,
        headers: {},
      }));
    }

    // OTLP HTTP exporter (for other collectors like Grafana Tempo)
    const otlpEndpoint = this.configService.get('OTLP_ENDPOINT');
    if (otlpEndpoint) {
      exporters.push(new OTLPTraceExporter({
        url: otlpEndpoint,
        headers: {
          'Authorization': `Bearer ${this.configService.get('OTLP_TOKEN', '')}`,
        },
      }));
    }

    // Default to console if no exporters configured
    if (exporters.length === 0) {
      this.logger.warn('No trace exporters configured, using console exporter');
      exporters.push(new ConsoleSpanExporter());
    }

    return exporters;
  }

  private getStatusClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500) return '5xx';
    return 'unknown';
  }

  /**
   * Create a new span
   */
  createSpan(name: string, options?: TraceOptions): opentelemetry.Span {
    if (!this.tracer) {
      return opentelemetry.trace.getActiveSpan() || opentelemetry.INVALID_SPAN;
    }

    const spanOptions: opentelemetry.SpanOptions = {
      attributes: {
        'service.name': this.serviceName,
        'service.version': this.configService.get('SERVICE_VERSION', '1.0.0'),
        'deployment.environment': this.environment,
        ...options?.attributes,
      },
    };

    return this.tracer.startSpan(name, spanOptions);
  }

  /**
   * Execute a function within a span context
   */
  async traceAsyncOperation<T>(
    name: string,
    operation: (span: opentelemetry.Span) => Promise<T>,
    options?: TraceOptions
  ): Promise<T> {
    const span = this.createSpan(name, options);

    try {
      const result = await opentelemetry.context.with(
        opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
        () => operation(span)
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
  }

  /**
   * Execute a synchronous function within a span context
   */
  traceSyncOperation<T>(
    name: string,
    operation: (span: opentelemetry.Span) => T,
    options?: TraceOptions
  ): T {
    const span = this.createSpan(name, options);

    try {
      const result = opentelemetry.context.with(
        opentelemetry.trace.setSpan(opentelemetry.context.active(), span),
        () => operation(span)
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
  }

  /**
   * Get the current active span
   */
  getActiveSpan(): opentelemetry.Span | undefined {
    return opentelemetry.trace.getActiveSpan();
  }

  /**
   * Get trace metadata for correlation
   */
  getTraceMetadata(): TraceMetadata | null {
    const span = this.getActiveSpan();
    if (!span) return null;

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      flags: spanContext.traceFlags.toString(16).padStart(2, '0'),
    };
  }

  /**
   * Add attributes to the current active span
   */
  addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = this.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  /**
   * Add an event to the current active span
   */
  addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = this.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Record an exception in the current active span
   */
  recordException(exception: Error, attributes?: Record<string, string | number | boolean>): void {
    const span = this.getActiveSpan();
    if (span) {
      span.recordException(exception, attributes);
      span.setStatus({
        code: opentelemetry.SpanStatusCode.ERROR,
        message: exception.message,
      });
    }
  }

  /**
   * Create a child span
   */
  createChildSpan(name: string, parentSpan?: opentelemetry.Span, attributes?: Record<string, string | number | boolean>): opentelemetry.Span {
    const parent = parentSpan || this.getActiveSpan();
    const context = parent ? opentelemetry.trace.setSpan(opentelemetry.context.active(), parent) : opentelemetry.context.active();

    return this.tracer.startSpan(name, {
      attributes: {
        'service.name': this.serviceName,
        ...attributes,
      },
    }, context);
  }

  /**
   * Inject trace context into headers for cross-service communication
   */
  injectTraceHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    
    opentelemetry.propagation.inject(opentelemetry.context.active(), headers);
    
    return headers;
  }

  /**
   * Extract trace context from headers
   */
  extractTraceContext(headers: Record<string, string>): opentelemetry.Context {
    return opentelemetry.propagation.extract(opentelemetry.context.active(), headers);
  }

  /**
   * Trace database operations
   */
  async traceDatabaseOperation<T>(
    operation: string,
    query: string,
    executor: () => Promise<T>
  ): Promise<T> {
    return this.traceAsyncOperation(
      `db.${operation}`,
      async (span) => {
        span.setAttributes({
          'db.system': 'mysql',
          'db.operation': operation,
          'db.statement': query.substring(0, 1000), // Truncate long queries
          'component': 'database',
        });

        const result = await executor();
        
        if (Array.isArray(result)) {
          span.setAttributes({
            'db.rows_affected': result.length,
          });
        }

        return result;
      }
    );
  }

  /**
   * Trace Redis operations
   */
  async traceRedisOperation<T>(
    command: string,
    key: string,
    executor: () => Promise<T>
  ): Promise<T> {
    return this.traceAsyncOperation(
      `redis.${command.toLowerCase()}`,
      async (span) => {
        span.setAttributes({
          'db.system': 'redis',
          'db.operation': command,
          'db.redis.key': key,
          'component': 'cache',
        });

        return await executor();
      }
    );
  }

  /**
   * Trace HTTP requests to external services
   */
  async traceHttpRequest<T>(
    method: string,
    url: string,
    executor: () => Promise<T>
  ): Promise<T> {
    return this.traceAsyncOperation(
      `http.${method.toLowerCase()}`,
      async (span) => {
        span.setAttributes({
          'http.method': method,
          'http.url': url,
          'component': 'http-client',
        });

        return await executor();
      }
    );
  }

  /**
   * Gracefully shutdown tracing
   */
  async shutdown(): Promise<void> {
    if (this.sdk) {
      await this.sdk.shutdown();
      this.logger.log('OpenTelemetry SDK shutdown completed');
    }
  }
}