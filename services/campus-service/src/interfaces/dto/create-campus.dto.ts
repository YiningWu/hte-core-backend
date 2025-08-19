import { IsNotEmpty, IsEnum, IsOptional, IsString, Length, IsNumber, IsEmail, IsDateString, IsArray } from 'class-validator';
import { CampusType, CampusStatus } from '@eduhub/shared';

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
  biz_hours?: any;

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
  trade_area_tags?: string[];

  @IsString()
  @IsOptional()
  remark?: string;
}