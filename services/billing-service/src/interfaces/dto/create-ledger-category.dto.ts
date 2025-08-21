import { IsNotEmpty, IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EntryType } from '../../domain/enums/billing.enum';

export class CreateLedgerCategoryDto {
  @ApiProperty({ description: '类型', enum: EntryType, example: EntryType.EXPENSE })
  @IsNotEmpty()
  @IsEnum(EntryType)
  type: EntryType;

  @ApiProperty({ description: '类目代码', example: 'rent' })
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiProperty({ description: '类目名称', example: '房租' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '是否与老师分成相关', default: false })
  @IsOptional()
  @IsBoolean()
  isTeacherRelated?: boolean = false;
}