import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Check } from 'typeorm';

@Entity('user_compensation')
@Index(['user_id', 'valid_from'])
@Index(['user_id', 'valid_from', 'valid_to'])
@Check(`"valid_from" < "valid_to" OR "valid_to" IS NULL`)
export class UserCompensation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  comp_id: number;

  @Column({ type: 'bigint' })
  org_id: number;

  @Column({ type: 'bigint' })
  @Index()
  user_id: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  base_salary: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  perf_salary: number;

  @Column({ type: 'date' })
  valid_from: Date;

  @Column({ type: 'date', nullable: true })
  valid_to: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string;

  @Column({ type: 'bigint' })
  created_by: number;

  @CreateDateColumn()
  created_at: Date;

  getTotalSalary(): number {
    return Number(this.base_salary) + Number(this.perf_salary);
  }

  isActiveOn(date: Date): boolean {
    const checkDate = new Date(date);
    const fromDate = new Date(this.valid_from);
    
    if (checkDate < fromDate) {
      return false;
    }

    if (this.valid_to) {
      const toDate = new Date(this.valid_to);
      return checkDate < toDate;
    }

    return true;
  }

  getDaysInRange(startDate: Date, endDate: Date): number {
    const rangeStart = new Date(Math.max(startDate.getTime(), new Date(this.valid_from).getTime()));
    const rangeEnd = this.valid_to 
      ? new Date(Math.min(endDate.getTime(), new Date(this.valid_to).getTime()))
      : new Date(endDate);

    if (rangeStart >= rangeEnd) {
      return 0;
    }

    const diffTime = rangeEnd.getTime() - rangeStart.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}