import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { PayrollStatus } from '@eduhub/shared';

@Entity('payroll_run')
@Index(['payroll_month', 'user_id'], { unique: true })
export class PayrollRun {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  run_id: number;

  @Column({ type: 'bigint' })
  org_id: number;

  @Column({ type: 'bigint' })
  @Index()
  user_id: number;

  @Column({ type: 'date' })
  payroll_month: Date;

  @Column({ type: 'date' })
  period_start: Date;

  @Column({ type: 'date' })
  period_end: Date;

  @Column({ type: 'int' })
  days_in_month: number;

  @Column({ type: 'int' })
  days_covered: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  base_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  perf_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  allowances: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  deductions: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  gross_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  net_amount: number;

  @Column({ type: 'enum', enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status: PayrollStatus;

  @Column({ type: 'json', nullable: true })
  snapshot_json: any;

  @CreateDateColumn()
  created_at: Date;

  calculateGrossAmount(): number {
    return Number(this.base_amount) + Number(this.perf_amount) + Number(this.allowances) - Number(this.deductions);
  }

  calculateNetAmount(): number {
    return this.calculateGrossAmount() - Number(this.tax_amount);
  }

  updateAmounts(): void {
    this.gross_amount = this.calculateGrossAmount();
    this.net_amount = this.calculateNetAmount();
  }
}