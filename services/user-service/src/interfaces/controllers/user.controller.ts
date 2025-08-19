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
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { UserService } from '../../application/services/user.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { QueryUserDto } from '../dto/query-user.dto';
import { ApiResponse as ApiResponseType, PaginationResponse, JwtAuthGuard, ResponseHelper } from '@eduhub/shared';
import { User } from '../../domain/entities/user.entity';

@ApiTags('Users')
@Controller('users')
@ApiHeader({ name: 'Authorization', description: 'Bearer token' })
@ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency' })
@ApiHeader({ name: 'X-Org-Id', description: 'Organization ID' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new user',
    description: 'Creates a new user in the organization with the provided details. Returns the user ID and creation timestamp.'
  })
  @ApiBody({ 
    type: CreateUserDto,
    description: 'User creation data',
    examples: {
      example1: {
        summary: 'New teacher user',
        value: {
          org_id: 1,
          campus_id: 1,
          username: 'teacher001',
          employment_status: 'ACTIVE',
          hire_date: '2024-01-01',
          email: 'teacher@example.com',
          phone: '+86 138-0000-1234',
          id_card_no: '110101199001011234',
          education: 'BACHELOR',
          gender: 'MALE',
          role: 'Teacher'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '用户创建成功' },
        data: {
          type: 'object',
          properties: {
            user_id: { type: 'number', example: 123 },
            created_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'User already exists (email or phone conflict)',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '邮箱已存在' },
        data: { type: 'null', example: null }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Actor-User-Id', description: 'Actor user ID for audit', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency', required: false, schema: { type: 'string', example: 'req-123' } })
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

    return ResponseHelper.created({
      user_id: user.user_id,
      created_at: user.created_at
    }, '用户创建成功');
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get user by ID',
    description: 'Retrieves user information by user ID. Sensitive data like ID card number is masked.'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID', example: 123 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'User found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '用户信息获取成功' },
        data: {
          type: 'object',
          properties: {
            user_id: { type: 'number', example: 123 },
            org_id: { type: 'number', example: 1 },
            campus_id: { type: 'number', example: 1 },
            username: { type: 'string', example: 'teacher001' },
            employment_status: { type: 'string', example: 'ACTIVE' },
            hire_date: { type: 'string', format: 'date', example: '2024-01-01' },
            email: { type: 'string', example: 'teacher@example.com' },
            phone: { type: 'string', example: '+86 138-****-1234' },
            id_card_no: { type: 'string', example: '110101****1234' },
            gender: { type: 'string', example: 'MALE' },
            role: { type: 'string', example: 'Teacher' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'User not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '用户不存在' },
        data: { type: 'null', example: null }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  async findById(
    @Param('id', ParseIntPipe) userId: number,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<User>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const user = await this.userService.findById(userId, parseInt(orgId));
    
    return ResponseHelper.found(user.maskSensitiveData() as User, '用户信息获取成功');
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get users with pagination',
    description: 'Retrieves a paginated list of users with optional filtering and sorting.'
  })
  @ApiQuery({ name: 'page', required: false, type: 'number', description: 'Page number (1-based)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: 'number', description: 'Items per page (max 100)', example: 20 })
  @ApiQuery({ name: 'search', required: false, type: 'string', description: 'Search by username, email, or phone', example: 'teacher' })
  @ApiQuery({ name: 'employment_status', required: false, enum: ['ACTIVE', 'INACTIVE', 'TERMINATED'], description: 'Filter by employment status' })
  @ApiQuery({ name: 'campus_id', required: false, type: 'number', description: 'Filter by campus ID', example: 1 })
  @ApiQuery({ name: 'role', required: false, type: 'string', description: 'Filter by user role', example: 'Teacher' })
  @ApiQuery({ name: 'sort_by', required: false, type: 'string', description: 'Sort field', example: 'created_at' })
  @ApiQuery({ name: 'sort_order', required: false, enum: ['asc', 'desc'], description: 'Sort order', example: 'desc' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Users retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '用户列表获取成功' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'number', example: 123 },
                  username: { type: 'string', example: 'teacher001' },
                  email: { type: 'string', example: 'teacher@example.com' },
                  employment_status: { type: 'string', example: 'ACTIVE' },
                  role: { type: 'string', example: 'Teacher' },
                  created_at: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'number', example: 150 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            totalPages: { type: 'number', example: 8 }
          }
        }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  async findAll(
    @Query(ValidationPipe) queryDto: QueryUserDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<PaginationResponse<User>>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const result = await this.userService.findAll(parseInt(orgId), queryDto);
    
    return ResponseHelper.found(result, '用户列表获取成功');
  }

  @Patch(':id')
  @ApiOperation({ 
    summary: 'Update user',
    description: 'Updates user information. Only provided fields will be updated.'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID', example: 123 })
  @ApiBody({ 
    type: UpdateUserDto,
    description: 'User update data (partial)',
    examples: {
      example1: {
        summary: 'Update email and role',
        value: {
          email: 'new.teacher@example.com',
          role: 'Senior Teacher'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'User updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '用户更新成功' },
        data: {
          type: 'object',
          properties: {
            updated: { type: 'boolean', example: true },
            updated_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'User not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '用户不存在' },
        data: { type: 'null', example: null }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.CONFLICT, 
    description: 'Email or phone already exists',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '邮箱已存在' },
        data: { type: 'null', example: null }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Actor-User-Id', description: 'Actor user ID for audit', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency', required: false, schema: { type: 'string', example: 'req-123' } })
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

    return ResponseHelper.updated({
      updated: true,
      updated_at: user.updated_at
    }, '用户更新成功');
  }

  @Delete(':id')
  @ApiOperation({ 
    summary: 'Delete user',
    description: 'Soft deletes a user. The user record is marked as deleted but not physically removed.'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID', example: 123 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'User deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '用户删除成功' },
        data: {
          type: 'object',
          properties: {
            deleted: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'User not found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: '用户不存在' },
        data: { type: 'null', example: null }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Actor-User-Id', description: 'Actor user ID for audit', required: true, schema: { type: 'string', example: '1' } })
  @ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency', required: false, schema: { type: 'string', example: 'req-123' } })
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

    return ResponseHelper.deleted('用户删除成功');
  }

  @Get(':id/changes')
  @ApiOperation({ 
    summary: 'Get user change history',
    description: 'Retrieves the audit log of changes made to a user within a specified date range.'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID', example: 123 })
  @ApiQuery({ name: 'from', required: false, type: 'string', description: 'Start date (ISO 8601)', example: '2024-01-01' })
  @ApiQuery({ name: 'to', required: false, type: 'string', description: 'End date (ISO 8601)', example: '2024-01-31' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Change history retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '变更历史获取成功' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  changed_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' },
                  changed_by: { type: 'number', example: 1 },
                  action: { type: 'string', example: 'UPDATE' },
                  diff: { 
                    type: 'object', 
                    example: { 
                      email: { old: 'old@example.com', new: 'new@example.com' },
                      role: { old: 'Teacher', new: 'Senior Teacher' }
                    }
                  },
                  request_id: { type: 'string', example: 'req-123' }
                }
              }
            }
          }
        }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
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

    return ResponseHelper.found({
      items: changes.map(change => ({
        changed_at: change.created_at,
        changed_by: change.actor_user_id,
        action: change.action,
        diff: change.diff_json,
        request_id: change.request_id
      }))
    }, '变更历史获取成功');
  }
}