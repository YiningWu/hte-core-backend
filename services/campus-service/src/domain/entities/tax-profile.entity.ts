import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { CampusBillingProfile } from './campus-billing-profile.entity';

@Entity('tax_profile')
export class TaxProfile {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  tax_profile_id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  rate: number;

  @Column({ type: 'boolean', default: false })
  is_tax_included: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => CampusBillingProfile, profile => profile.tax_profile)
  billing_profiles: CampusBillingProfile[];
}