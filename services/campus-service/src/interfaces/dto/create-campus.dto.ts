import { IsNotEmpty, IsEnum, IsOptional, IsString, Length, IsNumber, IsEmail, IsDateString, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CampusType, CampusStatus } from '@eduhub/shared';

export class BusinessHoursDto {
  @IsOptional()
  @IsString()
  'mon-fri'?: string; // e.g., "09:00-20:00"

  @IsOptional()
  @IsString()
  'sat-sun'?: string; // e.g., "09:00-18:00"

  @IsOptional()
  @IsString()
  monday?: string;

  @IsOptional()
  @IsString()
  tuesday?: string;

  @IsOptional()
  @IsString()
  wednesday?: string;

  @IsOptional()
  @IsString()
  thursday?: string;

  @IsOptional()
  @IsString()
  friday?: string;

  @IsOptional()
  @IsString()
  saturday?: string;

  @IsOptional()
  @IsString()
  sunday?: string;
}

export class CreateCampusDto {
  @IsNumber()
  @IsNotEmpty()
  org_id: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsEnum(CampusType)
  @IsOptional()
  type?: CampusType = CampusType.DIRECT;

  @IsEnum(CampusStatus)
  @IsOptional()
  status?: CampusStatus = CampusStatus.PREPARATION;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  province?: string;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  city?: string;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  district?: string;

  @IsString()
  @IsOptional()
  @Length(0, 200)
  address?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @IsOptional()
  principal_user_id?: number;

  @IsString()
  @IsOptional()
  @Length(0, 20)
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => BusinessHoursDto)
  biz_hours?: BusinessHoursDto;

  @IsDateString()
  @IsOptional()
  open_date?: string;

  @IsNumber()
  @IsOptional()
  area?: number;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @Length(1, 50, { each: true })
  trade_area_tags?: string[];

  @IsString()
  @IsOptional()
  remark?: string;
}