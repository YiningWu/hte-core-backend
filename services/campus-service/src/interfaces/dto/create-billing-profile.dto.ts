import { IsNotEmpty, IsString, Length, IsNumber, IsOptional } from 'class-validator';

export class CreateBillingProfileDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  invoice_title: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  tax_no: string;

  @IsString()
  @IsOptional()
  @Length(0, 100)
  bank_name?: string;

  @IsString()
  @IsOptional()
  @Length(0, 50)
  bank_account?: string;

  @IsString()
  @IsOptional()
  @Length(0, 200)
  invoice_address?: string;

  @IsString()
  @IsOptional()
  @Length(0, 20)
  phone?: string;

  @IsNumber()
  @IsNotEmpty()
  tax_profile_id: number;
}