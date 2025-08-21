import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { EntryType, EntryStatus } from '../enums/billing.enum';
import { LedgerBook } from './ledger-book.entity';
import { LedgerEntryTeacherShare } from './ledger-entry-teacher-share.entity';
import { LedgerAttachment } from './ledger-attachment.entity';

@Entity('ledger_entry')
@Index(['orgId', 'campusId', 'occurredAt'])
@Index(['orgId', 'campusId', 'type', 'categoryCode', 'occurredAt'])
@Index(['orgId', 'reporterName', 'occurredAt'])
@Index(['orgId', 'recorderName', 'occurredAt'])
@Index(['requestId'])
export class LedgerEntry {
  @PrimaryColumn({ type: 'char', length: 26, comment: 'ULID format' })
  entryId: string;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  bookId: number;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  orgId: number;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  campusId: number;

  @Column({ type: 'enum', enum: EntryType })
  type: EntryType;

  @Column({ type: 'varchar', length: 100 })
  categoryCode: string;

  @Column({ type: 'varchar', length: 255 })
  categoryName: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, comment: '金额，正数存储' })
  amount: number;

  @Column({ type: 'datetime', comment: '业务发生时间' })
  @Index()
  occurredAt: Date;

  @Column({ type: 'text', nullable: true, comment: '原始文本记录' })
  originalText?: string;

  @Column({ type: 'bigint', nullable: true, comment: '报告人用户ID' })
  reporterUserId?: number;

  @Column({ type: 'varchar', length: 255, comment: '报告人姓名' })
  reporterName: string;

  @Column({ type: 'bigint', nullable: true, comment: '记账人用户ID' })
  recorderUserId?: number;

  @Column({ type: 'varchar', length: 255, comment: '记账人姓名' })
  recorderName: string;

  @Column({ type: 'enum', enum: EntryStatus, default: EntryStatus.NORMAL })
  status: EntryStatus;

  @Column({ type: 'int', default: 0, comment: '附件数量冗余字段' })
  attachmentsCount: number;

  @Column({ type: 'bigint', nullable: false, comment: '创建操作人ID' })
  createdBy: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '幂等请求ID' })
  requestId?: string;

  // Relations
  @ManyToOne(() => LedgerBook, book => book.entries)
  @JoinColumn({ name: 'bookId' })
  book: LedgerBook;

  @OneToMany(() => LedgerEntryTeacherShare, teacherShare => teacherShare.entry, { cascade: true })
  teacherShares: LedgerEntryTeacherShare[];

  @OneToMany(() => LedgerAttachment, attachment => attachment.entry, { cascade: true })
  attachments: LedgerAttachment[];
}