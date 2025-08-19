import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('ENCRYPTION_KEY');
    if (!key || key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be exactly 32 characters long');
    }
    this.encryptionKey = Buffer.from(key, 'utf8');
  }

  encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Combine IV and encrypted data
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  hash(text: string): string {
    return crypto.createHash('sha256').update(text + this.encryptionKey.toString()).digest('hex');
  }

  maskIdCardNumber(idCard: string): string {
    if (!idCard || idCard.length < 8) {
      return idCard;
    }
    
    const start = idCard.substring(0, 4);
    const end = idCard.substring(idCard.length - 4);
    const middle = '*'.repeat(Math.max(0, idCard.length - 8));
    
    return start + middle + end;
  }

  maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 7) {
      return phone;
    }
    
    // Remove non-digit characters for processing
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) {
      return phone;
    }
    
    const start = digits.substring(0, 3);
    const end = digits.substring(digits.length - 4);
    const middle = '*'.repeat(Math.max(0, digits.length - 7));
    
    return start + middle + end;
  }

  maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email;
    }
    
    const [username, domain] = email.split('@');
    if (username.length <= 2) {
      return username + '*@' + domain;
    }
    
    const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);
    return maskedUsername + '@' + domain;
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  verifyHash(text: string, hash: string): boolean {
    return this.hash(text) === hash;
  }
}