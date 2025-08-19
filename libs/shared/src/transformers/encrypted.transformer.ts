import { ValueTransformer } from 'typeorm';
import { EncryptionService } from '../encryption/encryption.service';

export class EncryptedTransformer implements ValueTransformer {
  constructor(private encryptionService: EncryptionService) {}

  to(value: string): string {
    if (!value) return value;
    return this.encryptionService.encrypt(value);
  }

  from(value: string): string {
    if (!value) return value;
    try {
      return this.encryptionService.decrypt(value);
    } catch (error) {
      // If decryption fails, return original value (might be unencrypted data)
      return value;
    }
  }
}

export class HashedTransformer implements ValueTransformer {
  constructor(private encryptionService: EncryptionService) {}

  to(value: string): string {
    if (!value) return value;
    return this.encryptionService.hash(value);
  }

  from(value: string): string {
    // Hashes are one-way, return as-is
    return value;
  }
}