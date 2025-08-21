import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IDEMPOTENT_KEY, IdempotentOptions } from '../decorators/idempotent.decorator';
import { CacheService } from '../infrastructure/cache.service';

@Injectable()
export class IdempotentInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotentInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const options = this.reflector.get<IdempotentOptions>(
      IDEMPOTENT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    
    // Get idempotency key from headers
    const requestId = request.headers[options.keyField as string] as string;
    
    if (!requestId) {
      this.logger.warn(`Missing ${options.keyField} header for idempotent request`);
      return next.handle();
    }

    // Generate cache key
    const method = request.method;
    const path = request.path;
    const cacheKey = `idempotent:${method}:${path}:${requestId}`;

    try {
      // Check if this request was already processed
      const cachedResult = await this.cacheService.get(cacheKey);
      
      if (cachedResult) {
        this.logger.debug(`Returning cached result for idempotent request: ${requestId}`);
        
        // Parse cached result (it's already an object from cache service)
        const { statusCode, data, headers } = typeof cachedResult === 'string' ? JSON.parse(cachedResult) : cachedResult;
        
        // Set response headers if they were cached
        if (headers) {
          Object.keys(headers).forEach(key => {
            response.setHeader(key, headers[key]);
          });
        }
        
        response.status(statusCode);
        return new Observable(subscriber => {
          subscriber.next(data);
          subscriber.complete();
        });
      }

      // Mark request as processing to prevent concurrent duplicate requests
      const processingKey = `processing:${cacheKey}`;
      const isProcessing = await this.cacheService.get(processingKey);
      
      if (isProcessing) {
        throw new ConflictException(`Request ${requestId} is already being processed. Please wait.`);
      }

      // Set processing flag
      await this.cacheService.set(processingKey, { processing: true }, 30); // 30 seconds processing timeout

      return next.handle().pipe(
        tap(async (data) => {
          try {
            // Cache the successful result
            const resultToCache = {
              statusCode: response.statusCode,
              data,
              headers: this.getRelevantHeaders(response),
              timestamp: new Date().toISOString()
            };

            await this.cacheService.set(cacheKey, resultToCache, options.ttlSeconds);
            
            // Remove processing flag
            await this.cacheService.del(processingKey);
            
            this.logger.debug(`Cached result for idempotent request: ${requestId}`);
          } catch (error) {
            this.logger.error(`Failed to cache idempotent result: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Remove processing flag even on error
            await this.cacheService.del(processingKey);
          }
        }),
      );
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      
      this.logger.error(`Idempotent interceptor error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Fallback to normal execution if caching fails
      return next.handle();
    }
  }

  private getRelevantHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Only cache certain response headers
    const headersToCache = ['content-type', 'location', 'etag'];
    
    headersToCache.forEach(headerName => {
      const headerValue = response.getHeader(headerName);
      if (headerValue) {
        headers[headerName] = String(headerValue);
      }
    });
    
    return headers;
  }
}