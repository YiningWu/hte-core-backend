import { IsNotEmpty, IsString, Length, IsOptional } from 'class-validator';

export class CreateOrgDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsString()
  @IsOptional()
  remark?: string;
}

export class UpdateOrgDto {
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @IsString()
  @IsOptional()
  @Length(1, 50)
  code?: string;

  @IsString()
  @IsOptional()
  remark?: string;
}