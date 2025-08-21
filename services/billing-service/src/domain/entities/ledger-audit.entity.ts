import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { EntityType, AuditAction } from '../enums/billing.enum';

@Entity('ledger_audit')
@Index(['orgId', 'campusId'])
@Index(['entityType', 'entityId'])
@Index(['actorUserId'])
@Index(['requestId'])
@Index(['createdAt'])
export class LedgerAudit {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  orgId: number;

  @Column({ type: 'bigint', nullable: false })
  @Index()
  campusId: number;

  @Column({ type: 'enum', enum: EntityType })
  entityType: EntityType;

  @Column({ type: 'varchar', length: 255, comment: '被操作实体的ID' })
  entityId: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Column({ type: 'json', nullable: true, comment: '变更内容JSON' })
  diffJson?: object;

  @Column({ type: 'bigint', nullable: false, comment: '操作人用户ID' })
  actorUserId: number;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '请求ID' })
  requestId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: '操作原因' })
  reason?: string;

  @Column({ type: 'varchar', length: 45, nullable: true, comment: 'IP地址' })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 512, nullable: true, comment: '设备信息' })
  deviceInfo?: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}