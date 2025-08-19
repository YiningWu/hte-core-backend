import { Controller, Post, Body, ValidationPipe, UnauthorizedException, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { JwtService } from './jwt.service';
import { Public } from '../decorators/public.decorator';
import { ApiResponse as ApiResponseType } from '../types/common.types';

class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 50)
  password: string;
}

class RefreshTokenDto {
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
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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

    return {
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 24 * 60 * 60, // 24 hours in seconds
        user: {
          user_id: mockUser.user_id,
          username: mockUser.username,
          email: mockUser.email,
          roles: mockUser.roles
        }
      }
    };
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
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

    return {
      data: {
        access_token: accessToken,
        expires_in: 24 * 60 * 60
      }
    };
  }

  @Post('logout')
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Body() body: { token?: string }, @Request() req: any): Promise<ApiResponseType<{ message: string }>> {
    // Get token from body or from Authorization header
    let token = body?.token;
    if (!token) {
      const authHeader = req.headers.authorization;
      token = this.jwtService.extractTokenFromHeader(authHeader) || undefined;
    }
    
    if (token) {
      await this.jwtService.blacklistToken(token);
    }
    
    return {
      data: {
        message: 'Logged out successfully'
      }
    };
  }

  // Mock user validation - should be replaced with actual user service integration
  private async validateUser(email: string, password: string): Promise<any> {
    // TODO: Replace with actual user service call
    // This is a mock implementation
    const mockUsers = [
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