import { IsNotEmpty, IsEmail, IsEnum, IsOptional, IsDateString, IsNumber, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { EmploymentStatus, Education, Gender } from '@eduhub/shared';

export class CreateUserDto {
  @ApiProperty({ description: 'Organization ID', example: 1 })
  @IsNumber()
  @IsNotEmpty()
  org_id: number;

  @ApiProperty({ description: 'Campus ID', example: 1, required: false })
  @IsNumber()
  @IsOptional()
  campus_id?: number;

  @ApiProperty({ description: 'Username (3-50 characters)', example: 'teacher001', minLength: 3, maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  username: string;

  @ApiProperty({ 
    description: 'Employment status', 
    enum: EmploymentStatus, 
    example: EmploymentStatus.ACTIVE,
    required: false,
    default: EmploymentStatus.ACTIVE
  })
  @IsEnum(EmploymentStatus)
  @IsOptional()
  employment_status?: EmploymentStatus = EmploymentStatus.ACTIVE;

  @ApiProperty({ description: 'Hire date (ISO 8601)', example: '2024-01-01', format: 'date' })
  @IsDateString()
  @IsNotEmpty()
  hire_date: string;

  @ApiProperty({ description: 'Email address', example: 'teacher@example.com', format: 'email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: 'Phone number', example: '+86 138-0000-1234' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[\+]?[0-9\-\s\(\)]+$/)
  phone: string;

  @ApiProperty({ description: 'ID card number (15-18 characters)', example: '110101199001011234', minLength: 15, maxLength: 18 })
  @IsString()
  @IsNotEmpty()
  @Length(15, 18)
  id_card_no: string;

  @ApiProperty({ description: 'ID card file path', example: '/files/id_card_123.jpg', required: false })
  @IsString()
  @IsOptional()
  id_card_file?: string;

  @ApiProperty({ 
    description: 'Education level', 
    enum: Education, 
    example: Education.BACHELOR,
    required: false,
    default: Education.OTHER
  })
  @IsEnum(Education)
  @IsOptional()
  education?: Education = Education.OTHER;

  @ApiProperty({ description: 'Hukou address', example: 'Beijing Chaoyang District', required: false, maxLength: 200 })
  @IsString()
  @IsOptional()
  @Length(0, 200)
  hukou_address?: string;

  @ApiProperty({ description: 'Current address', example: 'Shanghai Pudong New Area', required: false, maxLength: 200 })
  @IsString()
  @IsOptional()
  @Length(0, 200)
  current_address?: string;

  @ApiProperty({ 
    description: 'Gender', 
    enum: Gender, 
    example: Gender.MALE,
    required: false,
    default: Gender.UNDISCLOSED
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender = Gender.UNDISCLOSED;

  @ApiProperty({ description: 'Role/position', example: 'Teacher', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @Length(0, 50)
  role?: string;

  @ApiProperty({ description: 'Age', example: 28, required: false })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  age?: number;
}