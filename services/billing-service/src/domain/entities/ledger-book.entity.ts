import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import { LedgerBookStatus, Currency } from '../enums/billing.enum';
import { LedgerEntry } from './ledger-entry.entity';

@Entity('ledger_book')
@Index(['orgId', 'campusId', 'status'])
export class LedgerBook {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  bookId: number;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  orgId: number;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  campusId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @Index()
  code?: string;

  @Column({ type: 'char', length: 3, default: Currency.CNY })
  currency: Currency;

  @Column({ type: 'enum', enum: LedgerBookStatus, default: LedgerBookStatus.ACTIVE })
  status: LedgerBookStatus;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @OneToMany(() => LedgerEntry, entry => entry.book)
  entries: LedgerEntry[];
}