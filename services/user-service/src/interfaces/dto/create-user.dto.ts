import { IsNotEmpty, IsEmail, IsEnum, IsOptional, IsDateString, IsNumber, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { EmploymentStatus, Education, Gender } from '@eduhub/shared';

export class CreateUserDto {
  @IsNumber()
  @IsNotEmpty()
  org_id: number;

  @IsNumber()
  @IsOptional()
  campus_id?: number;

  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  username: string;

  @IsEnum(EmploymentStatus)
  @IsOptional()
  employment_status?: EmploymentStatus = EmploymentStatus.ACTIVE;

  @IsDateString()
  @IsNotEmpty()
  hire_date: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[\+]?[0-9\-\s\(\)]+$/)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(15, 18)
  id_card_no: string;

  @IsString()
  @IsOptional()
  id_card_file?: string;

  @IsEnum(Education)
  @IsOptional()
  education?: Education = Education.OTHER;

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
  gender?: Gender = Gender.UNDISCLOSED;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  role?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  age?: number;
}