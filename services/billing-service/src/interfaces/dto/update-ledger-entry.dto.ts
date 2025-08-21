import { IsOptional, IsString, IsEnum, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { EntryStatus } from '../../domain/enums/billing.enum';
import { TeacherShareDto } from './teacher-share.dto';

export class UpdateLedgerEntryDto {
  @ApiPropertyOptional({ description: '类目代码', example: 'rent' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '类目名称', example: '房租' })
  @IsOptional()
  @IsString()
  categoryName?: string;

  @ApiPropertyOptional({ description: '金额', example: 3000 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  amount?: number;

  @ApiPropertyOptional({ description: '业务发生时间', example: '2025.06.16 15:12' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.replace(/\./g, '-');
    }
    return value;
  })
  time?: string;

  @ApiPropertyOptional({ description: '原始文本', example: '2025.6.16出账房租3000元' })
  @IsOptional()
  @IsString()
  originalText?: string;

  @ApiPropertyOptional({ description: '老师分成信息', type: [TeacherShareDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherShareDto)
  teacher?: TeacherShareDto[];

  @ApiPropertyOptional({ description: '状态', enum: EntryStatus })
  @IsOptional()
  @IsEnum(EntryStatus)
  status?: EntryStatus;

  @ApiPropertyOptional({ description: '变更原因' })
  @IsOptional()
  @IsString()
  changeReason?: string;
}