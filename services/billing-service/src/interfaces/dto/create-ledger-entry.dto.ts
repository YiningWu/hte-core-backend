import { IsNotEmpty, IsString, IsEnum, IsOptional, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { EntryType, EntryStatus } from '../../domain/enums/billing.enum';
import { TeacherShareDto } from './teacher-share.dto';

export class CreateLedgerEntryDto {
  @ApiProperty({ description: '账单ID', example: '175040357882335yclmtdq' })
  @IsNotEmpty()
  @IsString()
  id: string;

  @ApiProperty({ description: '类型', enum: EntryType, example: EntryType.EXPENSE })
  @IsNotEmpty()
  @IsEnum(EntryType)
  type: EntryType;

  @ApiProperty({ description: '类目代码', example: 'rent' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiProperty({ description: '类目名称', example: '房租' })
  @IsNotEmpty()
  @IsString()
  categoryName: string;

  @ApiPropertyOptional({ description: '金额', example: 3000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({ description: '原始文本', example: '2025.6.16出账房租3000元' })
  @IsOptional()
  @IsString()
  originalText?: string;

  @ApiProperty({ description: '业务发生时间', example: '2025.06.16 15:12' })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => {
    // 支持多种时间格式: "2025.06.16 15:12", "2025-06-16 15:12:00"
    if (typeof value === 'string') {
      return value.replace(/\./g, '-');
    }
    return value;
  })
  time: string;

  @ApiProperty({ description: '报告人', example: '老板' })
  @IsNotEmpty()
  @IsString()
  reporter: string;

  @ApiProperty({ description: '记账人', example: '系统' })
  @IsNotEmpty()
  @IsString()
  recorder: string;

  @ApiPropertyOptional({ description: '老师分成信息', type: [TeacherShareDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherShareDto)
  teacher?: TeacherShareDto[];

  @ApiPropertyOptional({ description: '附件列表' })
  @IsOptional()
  @IsArray()
  attachments?: any[];

  @ApiPropertyOptional({ description: '状态', enum: EntryStatus, default: EntryStatus.NORMAL })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus = EntryStatus.NORMAL;
}