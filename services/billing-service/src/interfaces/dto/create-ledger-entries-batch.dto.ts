import { IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CreateLedgerEntryDto } from './create-ledger-entry.dto';

export class CreateLedgerEntriesBatchDto {
  @ApiProperty({ description: '账单条目列表', type: [CreateLedgerEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLedgerEntryDto)
  entries: CreateLedgerEntryDto[];
}