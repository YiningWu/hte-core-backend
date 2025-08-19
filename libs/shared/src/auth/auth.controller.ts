import { Controller, Post, Body, ValidationPipe, UnauthorizedException, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { JwtService } from './jwt.service';
import { Public } from '../decorators/public.decorator';
import { ApiResponse as ApiResponseType } from '../types/common.types';
import { ResponseHelper } from '../utils/response.helper';

class LoginDto {
  @ApiProperty({ description: 'User email address', example: 'admin@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'User password (6-50 characters)', example: 'password123', minLength: 6, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password: string;
}

class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    user_id: number;
    org_id: number;
    username: string;
    email: string;
    roles: string[];
  };
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('login')
  @Public()
  @ApiOperation({ 
    summary: 'User login',
    description: 'Authenticates user and returns access token with user information including org_id'
  })
  @ApiBody({
    type: LoginDto,
    description: 'User login credentials',
    examples: {
      admin: {
        summary: 'Admin login',
        value: {
          email: 'admin@example.com',
          password: 'password123'
        }
      },
      teacher: {
        summary: 'Teacher login',
        value: {
          email: 'teacher@example.com',
          password: 'teacher123'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '登录成功' },
        data: {
          type: 'object',
          properties: {
            access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            expires_in: { type: 'number', example: 86400, description: 'Token expiration time in seconds' },
            user: {
              type: 'object',
              properties: {
                user_id: { type: 'number', example: 1 },
                org_id: { type: 'number', example: 1, description: 'Organization ID' },
                username: { type: 'string', example: 'admin' },
                email: { type: 'string', example: 'admin@example.com' },
                roles: { type: 'array', items: { type: 'string' }, example: ['admin', 'hr'] }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid credentials',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '邮箱或密码错误' },
        data: { type: 'null', example: null }
      }
    }
  })
  async login(@Body(ValidationPipe) loginDto: LoginDto): Promise<ApiResponseType<LoginResponse>> {
    // TODO: This should integrate with actual user service for authentication
    // For now, this is a mock implementation for demonstration
    const mockUser = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!mockUser) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload = {
      user_id: mockUser.user_id,
      org_id: mockUser.org_id,
      username: mockUser.username,
      roles: mockUser.roles
    };

    const accessToken = this.jwtService.generateToken(payload);
    const refreshToken = this.jwtService.generateRefreshToken(mockUser.user_id, mockUser.org_id);

    return ResponseHelper.login({
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 24 * 60 * 60, // 24 hours in seconds
      user: {
        user_id: mockUser.user_id,
        org_id: mockUser.org_id,
        username: mockUser.username,
        email: mockUser.email,
        roles: mockUser.roles
      }
    });
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ 
    summary: 'Refresh access token',
    description: 'Uses refresh token to generate a new access token'
  })
  @ApiBody({
    type: RefreshTokenDto,
    description: 'Refresh token data',
    examples: {
      example1: {
        summary: 'Refresh token example',
        value: {
          refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token refreshed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '令牌刷新成功' },
        data: {
          type: 'object',
          properties: {
            access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            expires_in: { type: 'number', example: 86400, description: 'Token expiration time in seconds' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid refresh token',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '用户不存在' },
        data: { type: 'null', example: null }
      }
    }
  })
  async refresh(@Body(ValidationPipe) refreshDto: RefreshTokenDto): Promise<ApiResponseType<{ access_token: string; expires_in: number }>> {
    const decoded = await this.jwtService.verifyRefreshToken(refreshDto.refresh_token);
    
    // TODO: Get user details from user service
    const mockUser = await this.getUserById(decoded.user_id);
    
    if (!mockUser) {
      throw new UnauthorizedException('User not found');
    }

    const payload = {
      user_id: mockUser.user_id,
      org_id: mockUser.org_id,
      username: mockUser.username,
      roles: mockUser.roles
    };

    const accessToken = this.jwtService.generateToken(payload);

    return ResponseHelper.success({
      access_token: accessToken,
      expires_in: 24 * 60 * 60
    }, '令牌刷新成功');
  }

  @Post('logout')
  @ApiOperation({ 
    summary: 'User logout',
    description: 'Blacklists the current access token to prevent further use'
  })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Access token to blacklist (optional, will use Authorization header if not provided)' }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Logout successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '登出成功' },
        data: { type: 'null', example: null }
      }
    }
  })
  async logout(@Body() body: { token?: string }, @Request() req: any): Promise<ApiResponseType<null>> {
    // Get token from body or from Authorization header
    let token = body?.token;
    if (!token) {
      const authHeader = req.headers.authorization;
      token = this.jwtService.extractTokenFromHeader(authHeader) || undefined;
    }
    
    if (token) {
      await this.jwtService.blacklistToken(token);
    }
    
    return ResponseHelper.logout('登出成功');
  }

  // Mock user validation - should be replaced with actual user service integration
  private async validateUser(email: string, password: string): Promise<any> {
    // TODO: Replace with actual user service call
    // This is a mock implementation
    const mockUsers = [
      {
        user_id: 0,
        org_id: 0, // 超级管理员不属于任何组织
        username: 'superadmin',
        email: 'superadmin@system.com',
        password: 'superadmin123',
        roles: ['superadmin', 'admin']
      },
      {
        user_id: 1,
        org_id: 1,
        username: 'admin',
        email: 'admin@example.com',
        password: 'password123', // In real implementation, this would be hashed
        roles: ['admin', 'hr']
      },
      {
        user_id: 2,
        org_id: 1,
        username: 'teacher001',
        email: 'teacher@example.com',
        password: 'teacher123',
        roles: ['teacher']
      }
    ];

    const user = mockUsers.find(u => u.email === email && u.password === password);
    return user || null;
  }

  // Mock user retrieval - should be replaced with actual user service integration
  private async getUserById(userId: number): Promise<any> {
    // TODO: Replace with actual user service call
    const mockUsers = [
      {
        user_id: 0,
        org_id: 0, // 超级管理员不属于任何组织
        username: 'superadmin',
        email: 'superadmin@system.com',
        roles: ['superadmin', 'admin']
      },
      {
        user_id: 1,
        org_id: 1,
        username: 'admin',
        email: 'admin@example.com',
        roles: ['admin', 'hr']
      },
      {
        user_id: 2,
        org_id: 1,
        username: 'teacher001',
        email: 'teacher@example.com',
        roles: ['teacher']
      }
    ];

    return mockUsers.find(u => u.user_id === userId) || null;
  }
}