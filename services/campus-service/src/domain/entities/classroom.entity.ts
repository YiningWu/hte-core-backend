import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ClassroomStatus } from '@eduhub/shared';
import { Campus } from './campus.entity';

@Entity('classroom')
@Index(['campus_id', 'status'])
export class Classroom {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  classroom_id: number;

  @Column({ type: 'bigint' })
  campus_id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'int', nullable: true })
  capacity: number;

  @Column({ type: 'json', nullable: true })
  course_type_tags: string[];

  @Column({ type: 'enum', enum: ClassroomStatus, default: ClassroomStatus.AVAILABLE })
  status: ClassroomStatus;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Campus, campus => campus.classrooms)
  @JoinColumn({ name: 'campus_id' })
  campus: Campus;
}