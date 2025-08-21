import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { LedgerEntry } from './ledger-entry.entity';

@Entity('ledger_attachment')
@Index(['entryId'])
export class LedgerAttachment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'char', length: 26 })
  entryId: string;

  @Column({ type: 'varchar', length: 512, comment: '对象存储Key或URL' })
  objectKey: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  mimeType?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalName?: string;

  @Column({ type: 'bigint', nullable: true, comment: '文件大小(字节)' })
  size?: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => LedgerEntry, entry => entry.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entryId' })
  entry: LedgerEntry;
}