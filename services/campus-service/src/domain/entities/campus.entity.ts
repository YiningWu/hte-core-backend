import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { CampusType, CampusStatus } from '@eduhub/shared';
import { Org } from './org.entity';
import { Classroom } from './classroom.entity';
import { CampusBillingProfile } from './campus-billing-profile.entity';

@Entity('campus')
@Index(['org_id', 'status'])
@Index(['org_id', 'name'])
export class Campus {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  campus_id: number;

  @Column({ type: 'bigint' })
  org_id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'enum', enum: CampusType, default: CampusType.DIRECT })
  type: CampusType;

  @Column({ type: 'enum', enum: CampusStatus, default: CampusStatus.PREPARATION })
  status: CampusStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  province: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  district: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'bigint', nullable: true })
  principal_user_id: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string;

  @Column({ type: 'json', nullable: true })
  biz_hours: any;

  @Column({ type: 'date', nullable: true })
  open_date: Date | null;

  @Column({ type: 'date', nullable: true })
  close_date: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  area: number;

  @Column({ type: 'int', nullable: true })
  capacity: number;

  @Column({ type: 'json', nullable: true })
  trade_area_tags: string[];

  @Column({ type: 'text', nullable: true })
  remark: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Org, org => org.campuses)
  @JoinColumn({ name: 'org_id' })
  org: Org;

  @OneToMany(() => Classroom, classroom => classroom.campus)
  classrooms: Classroom[];

  @OneToMany(() => CampusBillingProfile, profile => profile.campus)
  billing_profiles: CampusBillingProfile[];
}