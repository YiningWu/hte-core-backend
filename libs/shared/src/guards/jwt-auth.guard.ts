import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService, AuthenticatedUser } from '../auth/jwt.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const token = this.jwtService.extractTokenFromHeader(authHeader);
    if (!token) {
      throw new UnauthorizedException('Invalid authorization header format');
    }

    try {
      const payload = await this.jwtService.verifyToken(token);
      
      // Attach user info to request
      const user: AuthenticatedUser = {
        user_id: payload.user_id,
        org_id: payload.org_id,
        username: payload.username,
        roles: payload.roles
      };

      request.user = user;
      
      // Also set headers for compatibility
      request.headers['x-user-id'] = payload.user_id.toString();
      request.headers['x-org-id'] = payload.org_id.toString();
      request.headers['x-actor-user-id'] = payload.user_id.toString();

      this.logger.debug(`Authenticated user: ${payload.username} (ID: ${payload.user_id})`);
      
      return true;
    } catch (error) {
      this.logger.warn(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}