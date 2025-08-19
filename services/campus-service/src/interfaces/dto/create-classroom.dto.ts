import { IsNotEmpty, IsString, Length, IsNumber, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ClassroomStatus } from '@eduhub/shared';

export class CreateClassroomDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsOptional()
  course_type_tags?: string[];

  @IsEnum(ClassroomStatus)
  @IsOptional()
  status?: ClassroomStatus = ClassroomStatus.AVAILABLE;
}