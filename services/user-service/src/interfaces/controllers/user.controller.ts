import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { UserService } from '../../application/services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { QueryUserDto } from '../dto/query-user.dto';
import { ApiResponse as ApiResponseType, PaginationResponse, JwtAuthGuard } from '@eduhub/shared';
import { User } from '../../domain/entities/user.entity';

@ApiTags('Users')
@Controller('users')
@ApiHeader({ name: 'Authorization', description: 'Bearer token' })
@ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency' })
@ApiHeader({ name: 'X-Org-Id', description: 'Organization ID' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User created successfully' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'User already exists' })
  async create(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-Actor-User-Id') actorUserId: string,
    @Headers('X-Request-Id') requestId?: string
  ): Promise<ApiResponseType<{ user_id: number; created_at: Date }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    if (!actorUserId) {
      actorUserId = '1'; // Default actor_user_id for testing
    }
    const user = await this.userService.create(
      { ...createUserDto, org_id: parseInt(orgId) },
      parseInt(actorUserId),
      requestId
    );

    return {
      data: {
        user_id: user.user_id,
        created_at: user.created_at
      }
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User found' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async findById(
    @Param('id', ParseIntPipe) userId: number,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<User>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const user = await this.userService.findById(userId, parseInt(orgId));
    
    return {
      data: user.maskSensitiveData() as User
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get users with pagination' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Users retrieved successfully' })
  async findAll(
    @Query(ValidationPipe) queryDto: QueryUserDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<PaginationResponse<User>>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const result = await this.userService.findAll(parseInt(orgId), queryDto);
    
    return { data: result };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User updated successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Email or phone already exists' })
  async update(
    @Param('id', ParseIntPipe) userId: number,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-Actor-User-Id') actorUserId: string,
    @Headers('X-Request-Id') requestId?: string
  ): Promise<ApiResponseType<{ updated: boolean; updated_at: Date }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    if (!actorUserId) {
      actorUserId = '1'; // Default actor_user_id for testing
    }
    const user = await this.userService.update(userId, parseInt(orgId), updateUserDto, parseInt(actorUserId), requestId);

    return {
      data: {
        updated: true,
        updated_at: user.updated_at
      }
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async delete(
    @Param('id', ParseIntPipe) userId: number,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-Actor-User-Id') actorUserId: string,
    @Headers('X-Request-Id') requestId?: string
  ): Promise<ApiResponseType<{ deleted: boolean }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    if (!actorUserId) {
      actorUserId = '1'; // Default actor_user_id for testing
    }
    await this.userService.delete(userId, parseInt(orgId), parseInt(actorUserId), requestId);

    return {
      data: { deleted: true }
    };
  }

  @Get(':id/changes')
  @ApiOperation({ summary: 'Get user change history' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Change history retrieved successfully' })
  async getChangeHistory(
    @Param('id', ParseIntPipe) userId: number,
    @Headers('X-Org-Id') orgId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ): Promise<ApiResponseType<any>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const changes = await this.userService.getChangeHistory(userId, parseInt(orgId), from, to);

    return {
      data: {
        items: changes.map(change => ({
          changed_at: change.created_at,
          changed_by: change.actor_user_id,
          action: change.action,
          diff: change.diff_json,
          request_id: change.request_id
        }))
      }
    };
  }
}