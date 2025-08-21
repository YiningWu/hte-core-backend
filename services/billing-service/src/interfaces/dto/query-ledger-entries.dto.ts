import { IsOptional, IsString, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { EntryType, EntryStatus } from '../../domain/enums/billing.enum';

export class QueryLedgerEntriesDto {
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

  @ApiPropertyOptional({ description: '类目代码', example: 'new_signup' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '老师姓名', example: '崔晓燕' })
  @IsOptional()
  @IsString()
  teacher?: string;

  @ApiPropertyOptional({ description: '报告人', example: '崔晓燕' })
  @IsOptional()
  @IsString()
  reporter?: string;

  @ApiPropertyOptional({ description: '记账人', example: '系统' })
  @IsOptional()
  @IsString()
  recorder?: string;

  @ApiPropertyOptional({ description: '校区ID', example: 10201 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  campusId?: number;

  @ApiPropertyOptional({ description: '状态', enum: EntryStatus, default: EntryStatus.NORMAL })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus = EntryStatus.NORMAL;

  @ApiPropertyOptional({ description: '每页数量', example: 50, default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pageSize?: number = 20;

  @ApiPropertyOptional({ description: '游标分页', example: 'eyJwYWdlIjoyfQ==' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  q?: string;
}