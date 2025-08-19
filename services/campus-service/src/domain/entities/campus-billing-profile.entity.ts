import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Campus } from './campus.entity';
import { TaxProfile } from './tax-profile.entity';

@Entity('campus_billing_profile')
@Index(['campus_id'])
@Index(['tax_profile_id'])
export class CampusBillingProfile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  campus_id: number;

  @Column({ type: 'varchar', length: 200 })
  invoice_title: string;

  @Column({ type: 'varchar', length: 50 })
  tax_no: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank_name: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bank_account: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  invoice_address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string;

  @Column({ type: 'bigint' })
  tax_profile_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Campus, campus => campus.billing_profiles)
  @JoinColumn({ name: 'campus_id' })
  campus: Campus;

  @ManyToOne(() => TaxProfile, profile => profile.billing_profiles)
  @JoinColumn({ name: 'tax_profile_id' })
  tax_profile: TaxProfile;
}