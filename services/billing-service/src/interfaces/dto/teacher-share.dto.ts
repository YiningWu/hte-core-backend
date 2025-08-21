import { IsNotEmpty, IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TeacherShareDto {
  @ApiPropertyOptional({ description: '老师用户ID', example: 2001 })
  @IsOptional()
  @IsNumber()
  teacherUserId?: number;

  @ApiProperty({ description: '老师姓名', example: '崔晓燕' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: '分成比例', example: 0.2, minimum: 0, maximum: 1 })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  ratio: number;

  @ApiPropertyOptional({ description: '分成金额', example: 0 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  money?: number = 0;
}