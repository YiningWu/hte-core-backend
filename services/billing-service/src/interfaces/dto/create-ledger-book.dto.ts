import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../../domain/enums/billing.enum';

export class CreateLedgerBookDto {
  @ApiProperty({ description: '校区ID', example: 10201 })
  @IsNotEmpty()
  @IsNumber()
  campusId: number;

  @ApiProperty({ description: '账本名称', example: '回龙观校区账本' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '账本编码', example: 'CAMPUS-10201-BOOK01' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: '币种', enum: Currency, default: Currency.CNY })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency = Currency.CNY;
}