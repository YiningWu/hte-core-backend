import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';
import { EntryType } from '../enums/billing.enum';

@Entity('ledger_category')
@Unique('UQ_category_code_per_org_type', ['orgId', 'type', 'code'])
@Index(['orgId', 'type', 'isActive'])
export class LedgerCategory {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  categoryId: number;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  orgId: number;

  @Column({ type: 'enum', enum: EntryType })
  type: EntryType;

  @Column({ type: 'varchar', length: 100 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'boolean', default: false, comment: '是否与老师分成相关' })
  isTeacherRelated: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}