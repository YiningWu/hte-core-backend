import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';

@Entity('ledger_entry_teacher_share')
@Index(['entryId'])
@Index(['teacherName'])
@Index(['teacherUserId', 'entryId'])
export class LedgerEntryTeacherShare {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'char', length: 26 })
  entryId: string;

  @Column({ type: 'bigint', nullable: true, comment: '老师用户ID' })
  teacherUserId?: number;

  @Column({ type: 'varchar', length: 255, comment: '老师姓名' })
  teacherName: string;

  @Column({ type: 'decimal', precision: 5, scale: 4, comment: '分成比例 [0,1]' })
  ratio: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0, comment: '分成金额' })
  money: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => LedgerEntry, entry => entry.teacherShares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry: LedgerEntry;
}