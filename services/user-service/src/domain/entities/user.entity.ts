import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToMany, JoinTable } from 'typeorm';
import { EmploymentStatus, Education, Gender } from '@eduhub/shared';
import { Role } from './role.entity';

@Entity('user')
@Index(['org_id', 'campus_id'])
@Index(['employment_status', 'campus_id'])
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  user_id: number;

  @Column({ type: 'bigint' })
  @Index()
  org_id: number;

  @Column({ type: 'bigint', nullable: true })
  @Index()
  campus_id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'enum', enum: EmploymentStatus, default: EmploymentStatus.ACTIVE })
  employment_status: EmploymentStatus;

  @Column({ type: 'date' })
  hire_date: Date;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone: string;

  @Column({ 
    type: 'varchar', 
    length: 200, 
    unique: false, // Remove unique constraint as encrypted values will differ
    transformer: {
      to: (value: string) => value ? require('crypto').createHash('sha256').update(value + process.env.ENCRYPTION_KEY).digest('hex') : value,
      from: (value: string) => value // Hashed values cannot be decrypted
    }
  })
  id_card_no_hash: string; // Store hash for uniqueness checking

  @Column({ type: 'text', nullable: true })
  id_card_no_encrypted: string; // Store encrypted value

  @Column({ type: 'varchar', length: 500, nullable: true })
  id_card_file: string;

  @Column({ type: 'enum', enum: Education, default: Education.OTHER })
  education: Education;

  @Column({ type: 'varchar', length: 200, nullable: true })
  hukou_address: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  current_address: string;

  @Column({ type: 'enum', enum: Gender, default: Gender.UNDISCLOSED })
  gender: Gender;

  @Column({ type: 'varchar', length: 50, nullable: true })
  role: string;

  @Column({ type: 'tinyint', nullable: true })
  age: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToMany(() => Role, role => role.users)
  @JoinTable({
    name: 'user_role',
    joinColumn: { name: 'user_id', referencedColumnName: 'user_id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'role_id' }
  })
  roles: Role[];

  // Virtual property for ID card number
  get id_card_no(): string {
    if (this.id_card_no_encrypted) {
      try {
        const crypto = require('crypto');
        const parts = this.id_card_no_encrypted.split(':');
        if (parts.length === 2) {
          const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
          let decrypted = decipher.update(parts[1], 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return decrypted;
        }
      } catch (error) {
        console.error('Failed to decrypt ID card number:', error);
      }
    }
    return '';
  }

  set id_card_no(value: string) {
    if (value) {
      const crypto = require('crypto');
      // Create hash for uniqueness checking
      this.id_card_no_hash = crypto.createHash('sha256').update(value + process.env.ENCRYPTION_KEY).digest('hex');
      
      // Encrypt for storage
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      this.id_card_no_encrypted = iv.toString('hex') + ':' + encrypted;
    } else {
      this.id_card_no_hash = '';
      this.id_card_no_encrypted = '';
    }
  }

  maskSensitiveData(): Partial<User> {
    const masked = { ...this };
    if (this.id_card_no) {
      const idCard = this.id_card_no;
      if (idCard && idCard.length >= 8) {
        masked.id_card_no = idCard.substring(0, 4) + '**********' + idCard.substring(idCard.length - 4);
      }
    }
    // Remove encrypted fields from response
    delete (masked as any).id_card_no_encrypted;
    delete (masked as any).id_card_no_hash;
    return masked;
  }
}