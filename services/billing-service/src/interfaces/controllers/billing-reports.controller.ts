import {
  Controller,
  Get,
  Query,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery
} from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, CurrentUser } from '@eduhub/shared';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { BillingReportsService } from '../../application/services/billing-reports.service';
import { QueryReportsSummaryDto, QueryTeacherSharesDto, QueryByCategoryDto } from '../dto/query-reports.dto';

@ApiTags('账单报表')
@ApiBearerAuth()
@Controller('core/billing/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CacheInterceptor)
export class BillingReportsController {
  constructor(private readonly reportsService: BillingReportsService) {}

  @Get('summary')
  @Roles('super_admin', 'principal', 'finance', 'auditor')
  @CacheTTL(1800) // 30分钟缓存
  @ApiOperation({ summary: '概览报表（按日/月汇总）' })
  @ApiQuery({ name: 'from', required: false, description: '开始日期', example: '2025-06-01' })
  @ApiQuery({ name: 'to', required: false, description: '结束日期', example: '2025-06-30' })
  @ApiQuery({ name: 'campusId', required: false, description: '校区ID' })
  @ApiQuery({ name: 'groupBy', required: false, description: '分组方式', enum: ['day', 'month'], example: 'day' })
  @ApiResponse({
    status: 200,
    description: '报表数据',
    schema: {
      type: 'object',
      properties: {
        currency: { type: 'string', example: 'CNY' },
        period: {
          type: 'object',
          properties: {
            from: { type: 'string', example: '2025-06-01' },
            to: { type: 'string', example: '2025-06-30' }
          }
        },
        groupBy: { type: 'string', example: 'day' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '2025-06-16' },
              income: { type: 'number', example: 12000.00 },
              expense: { type: 'number', example: 3000.00 },
              net: { type: 'number', example: 9000.00 }
            }
          }
        },
        totals: {
          type: 'object',
          properties: {
            income: { type: 'number', example: 20000.00 },
            expense: { type: 'number', example: 3000.00 },
            net: { type: 'number', example: 17000.00 }
          }
        }
      }
    }
  })
  async getSummaryReport(
    @Query() queryDto: QueryReportsSummaryDto,
    @CurrentUser() user: any
  ) {
    // 权限控制：非超级管理员只能看到授权校区的数据
    let userCampusIds: number[] | undefined;
    if (user.role !== 'super_admin') {
      userCampusIds = user.campusIds || (user.campusId ? [user.campusId] : []);
    }

    return await this.reportsService.getSummaryReport(user.orgId, queryDto, userCampusIds);
  }

  @Get('teacher-shares')
  @Roles('super_admin', 'principal', 'finance', 'auditor')
  @CacheTTL(1800) // 30分钟缓存
  @ApiOperation({ summary: '老师分成报表（月度）' })
  @ApiQuery({ name: 'month', required: false, description: '月份(YYYY-MM-DD格式)', example: '2025-06-01' })
  @ApiQuery({ name: 'campusId', required: false, description: '校区ID' })
  @ApiQuery({ name: 'teacher', required: false, description: '老师姓名' })
  @ApiResponse({
    status: 200,
    description: '老师分成报表数据',
    schema: {
      type: 'object',
      properties: {
        month: { type: 'string', example: '2025-06-01' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              teacherName: { type: 'string', example: '崔晓燕' },
              entries: { type: 'number', example: 2 },
              amountTotal: { type: 'number', example: 20000.00 },
              shareTotal: { type: 'number', example: 4000.00 }
            }
          }
        },
        totals: {
          type: 'object',
          properties: {
            amountTotal: { type: 'number', example: 20000.00 },
            shareTotal: { type: 'number', example: 4000.00 }
          }
        }
      }
    }
  })
  async getTeacherSharesReport(
    @Query() queryDto: QueryTeacherSharesDto,
    @CurrentUser() user: any
  ) {
    // 权限控制：非超级管理员只能看到授权校区的数据
    let userCampusIds: number[] | undefined;
    if (user.role !== 'super_admin') {
      userCampusIds = user.campusIds || (user.campusId ? [user.campusId] : []);
    }

    return await this.reportsService.getTeacherSharesReport(user.orgId, queryDto, userCampusIds);
  }

  @Get('by-category')
  @Roles('super_admin', 'principal', 'finance', 'auditor')
  @CacheTTL(1800) // 30分钟缓存
  @ApiOperation({ summary: '类目分析报表' })
  @ApiQuery({ name: 'from', required: false, description: '开始日期', example: '2025-06-01' })
  @ApiQuery({ name: 'to', required: false, description: '结束日期', example: '2025-06-30' })
  @ApiQuery({ name: 'type', required: false, description: '类型', enum: ['income', 'expense'] })
  @ApiQuery({ name: 'campusId', required: false, description: '校区ID' })
  @ApiResponse({
    status: 200,
    description: '类目分析报表数据',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              categoryCode: { type: 'string', example: 'rent' },
              categoryName: { type: 'string', example: '房租' },
              count: { type: 'number', example: 1 },
              amount: { type: 'number', example: 3000.00 },
              sign: { type: 'number', example: -1, description: '+1 for income, -1 for expense' }
            }
          }
        }
      }
    }
  })
  async getCategoryReport(
    @Query() queryDto: QueryByCategoryDto,
    @CurrentUser() user: any
  ) {
    // 权限控制：非超级管理员只能看到授权校区的数据
    let userCampusIds: number[] | undefined;
    if (user.role !== 'super_admin') {
      userCampusIds = user.campusIds || (user.campusId ? [user.campusId] : []);
    }

    return await this.reportsService.getCategoryReport(user.orgId, queryDto, userCampusIds);
  }

  @Get('teacher-personal')
  @Roles('teacher')
  @CacheTTL(1800) // 30分钟缓存
  @ApiOperation({ summary: '老师个人分成报表' })
  @ApiQuery({ name: 'month', required: false, description: '月份(YYYY-MM-DD格式)', example: '2025-06-01' })
  async getPersonalTeacherReport(
    @Query('month') month?: string,
    @CurrentUser() user?: any
  ) {
    // 老师只能查看自己的分成报表
    return await this.reportsService.getTeacherSharesReport(
      user.orgId,
      { month, teacher: user.name },
      user.campusId ? [user.campusId] : undefined
    );
  }
}