import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { EntityType, ChangeAction } from '@eduhub/shared';

@Entity('audit_log')
@Index(['org_id', 'entity_type', 'entity_id'])
export class AuditLog {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  org_id: number;

  @Column({ type: 'bigint' })
  actor_user_id: number;

  @Column({ type: 'enum', enum: EntityType })
  entity_type: EntityType;

  @Column({ type: 'bigint' })
  entity_id: number;

  @Column({ type: 'enum', enum: ChangeAction })
  action: ChangeAction;

  @Column({ type: 'json', nullable: true })
  diff_json: any;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  request_id: string;
}