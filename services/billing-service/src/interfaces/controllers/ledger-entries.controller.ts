import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiHeader
} from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, CurrentUser, Idempotent } from '@eduhub/shared';
import { LedgerEntryService } from '../../application/services/ledger-entry.service';
import { CreateLedgerEntryDto } from '../dto/create-ledger-entry.dto';
import { CreateLedgerEntriesBatchDto } from '../dto/create-ledger-entries-batch.dto';
import { UpdateLedgerEntryDto } from '../dto/update-ledger-entry.dto';
import { QueryLedgerEntriesDto } from '../dto/query-ledger-entries.dto';

@ApiTags('账单管理')
@ApiBearerAuth()
@Controller('core/billing/entries')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerEntriesController {
  constructor(private readonly entryService: LedgerEntryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('super_admin', 'principal', 'finance')
  @Idempotent()
  @ApiOperation({ summary: '创建账单' })
  @ApiHeader({ name: 'X-Campus-Id', description: '校区ID', required: false })
  @ApiHeader({ name: 'X-Request-Id', description: '请求ID（幂等）', required: false })
  @ApiResponse({ status: 201, description: '账单创建成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 409, description: '账单ID冲突' })
  async create(
    @Body() createDto: CreateLedgerEntryDto,
    @Headers('X-Campus-Id') campusIdHeader?: string,
    @Headers('X-Request-Id') requestId?: string,
    @CurrentUser() user?: any
  ) {
    const campusId = campusIdHeader ? Number(campusIdHeader) : user.campusId;
    
    if (!campusId) {
      throw new Error('校区ID不能为空');
    }

    const entry = await this.entryService.create(
      createDto,
      user.orgId,
      campusId,
      user.userId,
      requestId
    );

    return {
      entryId: entry.entryId,
      status: entry.status,
      createdAt: entry.createdAt
    };
  }

  @Post(':batch')
  @HttpCode(HttpStatus.OK)
  @Roles('super_admin', 'principal', 'finance')
  @ApiOperation({ summary: '批量创建账单' })
  @ApiHeader({ name: 'X-Campus-Id', description: '校区ID', required: false })
  @ApiResponse({ status: 200, description: '批量处理完成' })
  async createBatch(
    @Body() batchDto: CreateLedgerEntriesBatchDto,
    @Headers('X-Campus-Id') campusIdHeader?: string,
    @CurrentUser() user?: any
  ) {
    const campusId = campusIdHeader ? Number(campusIdHeader) : user.campusId;
    
    if (!campusId) {
      throw new Error('校区ID不能为空');
    }

    const result = await this.entryService.createBatch(
      batchDto.entries,
      user.orgId,
      campusId,
      user.userId
    );

    return {
      success: result.success.length,
      failures: result.failures.length,
      successEntries: result.success.map(entry => ({
        entryId: entry.entryId,
        status: entry.status
      })),
      failureDetails: result.failures
    };
  }

  @Get()
  @Roles('super_admin', 'principal', 'finance', 'auditor', 'teacher')
  @ApiOperation({ summary: '获取账单列表' })
  @ApiQuery({ name: 'from', required: false, description: '开始日期', example: '2025-06-01' })
  @ApiQuery({ name: 'to', required: false, description: '结束日期', example: '2025-06-30' })
  @ApiQuery({ name: 'type', required: false, description: '类型' })
  @ApiQuery({ name: 'category', required: false, description: '类目代码' })
  @ApiQuery({ name: 'teacher', required: false, description: '老师姓名' })
  @ApiQuery({ name: 'reporter', required: false, description: '报告人' })
  @ApiQuery({ name: 'recorder', required: false, description: '记账人' })
  @ApiQuery({ name: 'campusId', required: false, description: '校区ID' })
  @ApiQuery({ name: 'status', required: false, description: '状态' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量' })
  @ApiQuery({ name: 'cursor', required: false, description: '游标分页' })
  @ApiQuery({ name: 'q', required: false, description: '搜索关键词' })
  async findAll(
    @Query() queryDto: QueryLedgerEntriesDto,
    @CurrentUser() user: any
  ) {
    // 权限控制：非超级管理员只能看到授权校区的数据
    let userCampusIds: number[] | undefined;
    if (user.role !== 'super_admin') {
      userCampusIds = user.campusIds || (user.campusId ? [user.campusId] : []);
    }

    return await this.entryService.findAll(user.orgId, queryDto, userCampusIds);
  }

  @Get(':entryId')
  @Roles('super_admin', 'principal', 'finance', 'auditor', 'teacher')
  @ApiOperation({ summary: '获取账单详情' })
  @ApiParam({ name: 'entryId', description: '账单ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '账单不存在' })
  async findOne(
    @Param('entryId') entryId: string,
    @CurrentUser() user: any
  ) {
    const entry = await this.entryService.findById(entryId, user.orgId);

    // 老师权限检查：只能查看与自己相关的账单
    if (user.role === 'teacher') {
      const hasTeacherAccess = entry.teacherShares?.some(share => 
        share.teacherName === user.name || share.teacherUserId === user.userId
      ) || entry.reporterName === user.name;

      if (!hasTeacherAccess) {
        throw new Error('无权限访问此账单');
      }
    }

    return entry;
  }

  @Patch(':entryId')
  @Roles('super_admin', 'principal', 'finance')
  @ApiOperation({ summary: '更新账单' })
  @ApiParam({ name: 'entryId', description: '账单ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '账单不存在' })
  async update(
    @Param('entryId') entryId: string,
    @Body() updateDto: UpdateLedgerEntryDto,
    @CurrentUser() user: any
  ) {
    const entry = await this.entryService.update(entryId, updateDto, user.orgId, user.userId);
    return {
      updated: true,
      updatedAt: entry.updatedAt
    };
  }

  @Post(':entryId/void')
  @Roles('super_admin', 'principal', 'finance')
  @ApiOperation({ summary: '作废账单' })
  @ApiParam({ name: 'entryId', description: '账单ID' })
  @ApiResponse({ status: 200, description: '作废成功' })
  async void(
    @Param('entryId') entryId: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: any
  ) {
    const entry = await this.entryService.void(entryId, user.orgId, user.userId, body.reason);
    return {
      entryId: entry.entryId,
      status: entry.status
    };
  }
}