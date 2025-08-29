import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
  UseGuards,
  Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { CampusService } from '../../application/services/campus.service';
import { CreateCampusDto } from '../dto/create-campus.dto';
import { CreateClassroomDto } from '../dto/create-classroom.dto';
import { CreateBillingProfileDto } from '../dto/create-billing-profile.dto';
import { QueryCampusDto } from '../dto/query-campus.dto';
import { ApiResponse as ApiResponseType, JwtAuthGuard, ResponseHelper, CampusStatus } from '@eduhub/shared';

@ApiTags('Campuses')
@Controller('campuses')
@ApiHeader({ name: 'Authorization', description: 'Bearer token' })
@ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency' })
@ApiHeader({ name: 'X-Org-Id', description: 'Organization ID' })
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Create a new campus',
    description: 'Creates a new campus for the organization with location and configuration details.'
  })
  @ApiBody({ 
    type: CreateCampusDto,
    description: 'Campus creation data',
    examples: {
      example1: {
        summary: 'New campus in Beijing',
        value: {
          org_id: 1,
          name: 'Beijing Main Campus',
          code: 'BJ001',
          type: 'DIRECT',
          status: 'PREPARATION',
          province: 'Beijing',
          city: 'Beijing',
          district: 'Chaoyang',
          address: '123 Education Street',
          latitude: 39.9042,
          longitude: 116.4074,
          principal_user_id: 1001,
          phone: '+86 10-8888-8888',
          email: 'beijing@example.com',
          biz_hours: {
            'mon-fri': '09:00-20:00',
            'sat-sun': '09:00-18:00'
          },
          area: 5000,
          capacity: 500,
          trade_area_tags: ['地铁10号线', '商圈A', 'CBD核心区'],
          remark: '主要校区，设施完善'
        }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Campus created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '校园创建成功' },
        data: {
          type: 'object',
          properties: {
            campus_id: { type: 'number', example: 1 },
            created_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  async create(
    @Body(ValidationPipe) createCampusDto: CreateCampusDto,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-User-Id') userId: string
  ): Promise<ApiResponseType<{ campus_id: number; created_at: Date }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    if (!userId) {
      userId = '1';
    }
    const campus = await this.campusService.createCampus({
      ...createCampusDto,
      org_id: parseInt(orgId)
    }, parseInt(userId));

    return ResponseHelper.created({
      campus_id: campus.campus_id,
      created_at: campus.created_at
    }, '校园创建成功');
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get campus by ID',
    description: 'Retrieves detailed campus information including location and configuration.'
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Campus ID', example: 1 })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Campus found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '校园信息获取成功' },
        data: {
          type: 'object',
          properties: {
            campus_id: { type: 'number', example: 1 },
            org_id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Beijing Main Campus' },
            code: { type: 'string', example: 'BJ001' },
            type: { type: 'string', example: 'DIRECT' },
            status: { type: 'string', example: 'ACTIVE' },
            province: { type: 'string', example: 'Beijing' },
            city: { type: 'string', example: 'Beijing' },
            district: { type: 'string', example: 'Chaoyang' },
            address: { type: 'string', example: '123 Education Street' },
            latitude: { type: 'number', example: 39.9042 },
            longitude: { type: 'number', example: 116.4074 },
            phone: { type: 'string', example: '+86 10-8888-8888' },
            email: { type: 'string', example: 'beijing@example.com' },
            area: { type: 'number', example: 5000 },
            capacity: { type: 'number', example: 500 },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  })
  async findById(
    @Param('id', ParseIntPipe) campusId: number,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<any>> {
    const campus = await this.campusService.findCampusById(campusId, parseInt(orgId));
    
    return ResponseHelper.found(campus, '校园信息获取成功');
  }

  @Get()
  @ApiOperation({
    summary: 'Get all campuses for organization',
    description: 'Retrieves all campuses belonging to the organization.'
  })
  @ApiQuery({ name: 'q', required: false, type: 'string', description: 'Search by name or code', example: 'Beijing' })
  @ApiQuery({ name: 'status', required: false, enum: CampusStatus, description: 'Filter by campus status' })
  @ApiQuery({ name: 'page_size', required: false, type: 'number', description: 'Items per page (max 100)', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, type: 'string', description: 'Cursor for pagination', example: 'eyBjYW1wdXNfaWQ6IDEwIH0=' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Campuses retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '校园列表获取成功' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  campus_id: { type: 'number', example: 1 },
                  name: { type: 'string', example: 'Beijing Main Campus' },
                  code: { type: 'string', example: 'BJ001' },
                  type: { type: 'string', example: 'DIRECT' },
                  status: { type: 'string', example: 'OPERATING' },
                  city: { type: 'string', example: 'Beijing' },
                  address: { type: 'string', example: '123 Education Street' },
                  capacity: { type: 'number', example: 500 }
                }
              }
            },
            next_cursor: { type: 'string', nullable: true, example: 'eyBjYW1wdXNfaWQ6IDEwIH0=' },
            total: { type: 'number', example: 100 }
          }
        }
      }
    }
  })
  @ApiHeader({ name: 'X-Org-Id', description: 'Organization ID (required)', required: true, schema: { type: 'string', example: '1' } })
  async findAll(
    @Query(ValidationPipe) queryDto: QueryCampusDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<any>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const campuses = await this.campusService.findAllCampuses(parseInt(orgId), queryDto);

    return ResponseHelper.found(campuses, '校园列表获取成功');
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campus' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Campus updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '校园更新成功' },
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
  async update(
    @Param('id', ParseIntPipe) campusId: number,
    @Body(ValidationPipe) updateData: Partial<CreateCampusDto>,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-User-Id') userId: string
  ): Promise<ApiResponseType<{ updated: boolean; updated_at: Date }>> {
    if (!userId) {
      userId = '1';
    }
    const campus = await this.campusService.updateCampus(campusId, parseInt(orgId), updateData, parseInt(userId));

    return ResponseHelper.updated({
      updated: true,
      updated_at: campus.updated_at
    }, '校园更新成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete campus' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Campus deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '校园删除成功' },
        data: {
          type: 'object',
          properties: {
            deleted: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  async delete(
    @Param('id', ParseIntPipe) campusId: number,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-User-Id') userId: string
  ): Promise<ApiResponseType<{ deleted: boolean }>> {
    if (!userId) {
      userId = '1';
    }
    await this.campusService.deleteCampus(campusId, parseInt(orgId), parseInt(userId));

    return ResponseHelper.deleted('校园删除成功');
  }

  @Post(':id/classrooms')
  @ApiOperation({ summary: 'Create classroom for campus' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Classroom created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '教室创建成功' },
        data: {
          type: 'object',
          properties: {
            classroom_id: { type: 'number', example: 1 }
          }
        }
      }
    }
  })
  async createClassroom(
    @Param('id', ParseIntPipe) campusId: number,
    @Body(ValidationPipe) createClassroomDto: CreateClassroomDto,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-User-Id') userId: string
  ): Promise<ApiResponseType<{ classroom_id: number }>> {
    if (!userId) {
      userId = '1';
    }
    const classroom = await this.campusService.createClassroom(campusId, parseInt(orgId), createClassroomDto, parseInt(userId));

    return ResponseHelper.created({ classroom_id: classroom.classroom_id }, '教室创建成功');
  }

  @Post(':id/billing-profiles')
  @ApiOperation({ summary: 'Create billing profile for campus' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Billing profile created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '账单配置创建成功' },
        data: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            created_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  async createBillingProfile(
    @Param('id', ParseIntPipe) campusId: number,
    @Body(ValidationPipe) createBillingProfileDto: CreateBillingProfileDto,
    @Headers('X-Org-Id') orgId: string,
    @Headers('X-User-Id') userId: string
  ): Promise<ApiResponseType<{ id: number; created_at: Date }>> {
    if (!userId) {
      userId = '1';
    }
    const profile = await this.campusService.createBillingProfile(campusId, parseInt(orgId), createBillingProfileDto, parseInt(userId));

    return ResponseHelper.created({
      id: profile.id,
      created_at: profile.created_at
    }, '计费配置创建成功');
  }
}