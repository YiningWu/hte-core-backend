import { IsOptional, IsString, IsEnum, IsNumber, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EntryType } from '../../domain/enums/billing.enum';

export class QueryReportsSummaryDto {
  @ApiPropertyOptional({ description: '开始日期', example: '2025-06-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: '结束日期', example: '2025-06-30' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: '校区ID', example: 10201 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  campusId?: number;

  @ApiPropertyOptional({ description: '分组方式', example: 'day', enum: ['day', 'month'] })
  @IsOptional()
  @IsIn(['day', 'month'])
  groupBy?: 'day' | 'month' = 'day';
}

export class QueryTeacherSharesDto {
  @ApiPropertyOptional({ description: '月份(YYYY-MM-DD格式)', example: '2025-06-01' })
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional({ description: '校区ID', example: 10201 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  campusId?: number;

  @ApiPropertyOptional({ description: '老师姓名', example: '崔晓燕' })
  @IsOptional()
  @IsString()
  teacher?: string;
}

export class QueryByCategoryDto {
  @ApiPropertyOptional({ description: '开始日期', example: '2025-06-01' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: '结束日期', example: '2025-06-30' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: '类型', enum: EntryType })
  @IsOptional()
  @IsEnum(EntryType)
  type?: EntryType;

  @ApiPropertyOptional({ description: '校区ID', example: 10201 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  campusId?: number;
}