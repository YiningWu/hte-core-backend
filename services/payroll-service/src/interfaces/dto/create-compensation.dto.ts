import { IsNotEmpty, IsNumber, IsDateString, IsString, IsOptional, Min } from 'class-validator';

export class CreateCompensationDto {
  @IsNumber()
  @IsNotEmpty()
  org_id: number;

  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsNumber()
  @Min(0)
  base_salary: number;

  @IsNumber()
  @Min(0)
  perf_salary: number;

  @IsDateString()
  @IsNotEmpty()
  valid_from: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsNumber()
  @IsNotEmpty()
  operator_id: number;
}