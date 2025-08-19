import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { RedisService } from '../infrastructure/redis.service';

export interface JwtPayload {
  user_id: number;
  org_id: number;
  username: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  user_id: number;
  org_id: number;
  username: string;
  roles: string[];
}

@Injectable()
export class JwtService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService
  ) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET') || '';
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '24h');

    if (!this.jwtSecret) {
      throw new Error('JWT_SECRET is required but not provided in environment variables');
    }
  }

  generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    // Add a nonce to ensure token uniqueness even with same payload
    const tokenPayload = {
      ...payload,
      nonce: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    };
    
    return jwt.sign(tokenPayload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      // Check if token is blacklisted
      const isBlacklisted = await this.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedException('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedException('Token has expired');
      }
      throw error;
    }
  }

  async blacklistToken(token: string): Promise<void> {
    try {
      const decoded = jwt.decode(token) as JwtPayload;
      if (decoded && decoded.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await this.redisService.set(`blacklist:${token}`, 'revoked', ttl);
        }
      }
    } catch (error) {
      // If we can't decode or set blacklist, the token might be invalid anyway
      console.warn('Failed to blacklist token:', error);
    }
  }

  private async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await this.redisService.get(`blacklist:${token}`);
      return result === 'revoked';
    } catch (error) {
      // If Redis is unavailable, allow the request to continue
      return false;
    }
  }

  extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  generateRefreshToken(userId: number, orgId: number): string {
    return jwt.sign(
      { 
        user_id: userId, 
        org_id: orgId, 
        type: 'refresh' 
      }, 
      this.jwtSecret, 
      { expiresIn: '7d' }
    );
  }

  async verifyRefreshToken(token: string): Promise<{ user_id: number; org_id: number }> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      if (decoded.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }
      return { user_id: decoded.user_id, org_id: decoded.org_id };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}