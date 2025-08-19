import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaxProfile } from '../../domain/entities/tax-profile.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { CreateTaxProfileDto, UpdateTaxProfileDto } from '../../interfaces/dto/create-tax-profile.dto';
import { EntityType, ChangeAction } from '@eduhub/shared';

@Injectable()
export class TaxProfileService {
  constructor(
    @InjectRepository(TaxProfile)
    private readonly taxProfileRepository: Repository<TaxProfile>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>
  ) {}

  async createTaxProfile(createTaxProfileDto: CreateTaxProfileDto, actorUserId: number): Promise<TaxProfile> {
    // Check for duplicate name
    const existingTaxProfile = await this.taxProfileRepository.findOne({
      where: { name: createTaxProfileDto.name }
    });

    if (existingTaxProfile) {
      throw new ConflictException('Tax profile name already exists');
    }

    const taxProfile = this.taxProfileRepository.create(createTaxProfileDto);
    const savedTaxProfile = await this.taxProfileRepository.save(taxProfile);

    await this.createAuditLog({
      org_id: 1, // TODO: Get from context or parameter
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: savedTaxProfile.tax_profile_id,
      action: ChangeAction.CREATE,
      diff_json: { created: createTaxProfileDto }
    });

    return savedTaxProfile;
  }

  async findTaxProfileById(taxProfileId: number): Promise<TaxProfile> {
    const taxProfile = await this.taxProfileRepository.findOne({
      where: { tax_profile_id: taxProfileId },
      relations: ['billing_profiles']
    });

    if (!taxProfile) {
      throw new NotFoundException('Tax profile not found');
    }

    return taxProfile;
  }

  async findAllTaxProfiles(): Promise<TaxProfile[]> {
    return await this.taxProfileRepository.find({
      relations: ['billing_profiles'],
      order: { created_at: 'DESC' }
    });
  }

  async updateTaxProfile(taxProfileId: number, updateTaxProfileDto: UpdateTaxProfileDto, actorUserId: number): Promise<TaxProfile> {
    const existingTaxProfile = await this.findTaxProfileById(taxProfileId);

    // Check for duplicate name (excluding current tax profile)
    if (updateTaxProfileDto.name) {
      const duplicateTaxProfile = await this.taxProfileRepository.findOne({
        where: { name: updateTaxProfileDto.name }
      });

      if (duplicateTaxProfile && duplicateTaxProfile.tax_profile_id !== taxProfileId) {
        throw new ConflictException('Tax profile name already exists');
      }
    }

    const previousData = { ...existingTaxProfile };
    Object.assign(existingTaxProfile, updateTaxProfileDto);

    const updatedTaxProfile = await this.taxProfileRepository.save(existingTaxProfile);

    await this.createAuditLog({
      org_id: 1, // TODO: Get from context or parameter
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: updatedTaxProfile.tax_profile_id,
      action: ChangeAction.UPDATE,
      diff_json: {
        previous: previousData,
        updated: updateTaxProfileDto
      }
    });

    return updatedTaxProfile;
  }

  async deleteTaxProfile(taxProfileId: number, actorUserId: number): Promise<void> {
    const taxProfile = await this.findTaxProfileById(taxProfileId);

    // Check if tax profile is being used by billing profiles
    if (taxProfile.billing_profiles && taxProfile.billing_profiles.length > 0) {
      throw new ConflictException('Cannot delete tax profile that is being used by billing profiles');
    }

    await this.taxProfileRepository.remove(taxProfile);

    await this.createAuditLog({
      org_id: 1, // TODO: Get from context or parameter
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: taxProfileId,
      action: ChangeAction.DELETE,
      diff_json: { deleted: taxProfile }
    });
  }

  private async createAuditLog(auditData: Partial<AuditLog>): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(auditData);
    return await this.auditLogRepository.save(auditLog);
  }
}