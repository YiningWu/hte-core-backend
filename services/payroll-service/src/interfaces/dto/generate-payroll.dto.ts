import { IsNotEmpty, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';

export class GeneratePayrollDto {
  @IsNumber()
  @IsNotEmpty()
  org_id: number;

  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsDateString()
  @IsNotEmpty()
  month: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  allowances?: number = 0;

  @IsNumber()
  @IsOptional()
  @Min(0)
  deductions?: number = 0;
}

export class GenerateBatchPayrollDto {
  @IsNumber()
  @IsNotEmpty()
  org_id: number;

  @IsDateString()
  @IsNotEmpty()
  month: string;

  @IsOptional()
  filter?: {
    campus_ids?: number[];
    employment_status?: string;
  };
}