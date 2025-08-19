import { IsNotEmpty, IsString, Length, IsNumber, IsBoolean, Min, Max, IsOptional } from 'class-validator';

export class CreateTaxProfileDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  rate: number;

  @IsBoolean()
  @IsOptional()
  is_tax_included?: boolean = false;
}

export class UpdateTaxProfileDto {
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  rate?: number;

  @IsBoolean()
  @IsOptional()
  is_tax_included?: boolean;
}