import { IsEnum, IsOptional, IsEmail, IsString, Length, Matches, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';
import { EmploymentStatus, Education, Gender } from '@eduhub/shared';

export class UpdateUserDto {
  @IsEnum(EmploymentStatus)
  @IsOptional()
  employment_status?: EmploymentStatus;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[\+]?[0-9\-\s\(\)]+$/)
  phone?: string;

  @IsString()
  @IsOptional()
  @Length(15, 18)
  id_card_no?: string;

  @IsString()
  @IsOptional()
  id_card_file?: string;

  @IsEnum(Education)
  @IsOptional()
  education?: Education;

  @IsString()
  @IsOptional()
  @Length(0, 200)
  hukou_address?: string;

  @IsString()
  @IsOptional()
  @Length(0, 200)
  current_address?: string;

  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  role?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  age?: number;

  @IsNumber()
  @IsOptional()
  campus_id?: number;

  @IsString()
  @IsOptional()
  @Length(0, 200)
  change_reason?: string;
}