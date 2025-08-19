import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Org } from '../../domain/entities/org.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { CreateOrgDto, UpdateOrgDto } from '../../interfaces/dto/create-org.dto';
import { EntityType, ChangeAction } from '@eduhub/shared';

@Injectable()
export class OrgService {
  constructor(
    @InjectRepository(Org)
    private readonly orgRepository: Repository<Org>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>
  ) {}

  async createOrg(createOrgDto: CreateOrgDto, actorUserId: number): Promise<Org> {
    // Check for duplicate name or code
    const existingOrg = await this.orgRepository.findOne({
      where: [
        { name: createOrgDto.name },
        { code: createOrgDto.code }
      ]
    });

    if (existingOrg) {
      if (existingOrg.name === createOrgDto.name) {
        throw new ConflictException('Organization name already exists');
      }
      if (existingOrg.code === createOrgDto.code) {
        throw new ConflictException('Organization code already exists');
      }
    }

    const org = this.orgRepository.create(createOrgDto);
    const savedOrg = await this.orgRepository.save(org);

    await this.createAuditLog({
      org_id: savedOrg.org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS, // Using campus as closest entity type
      entity_id: savedOrg.org_id,
      action: ChangeAction.CREATE,
      diff_json: { created: createOrgDto }
    });

    return savedOrg;
  }

  async findOrgById(orgId: number): Promise<Org> {
    const org = await this.orgRepository.findOne({
      where: { org_id: orgId },
      relations: ['campuses']
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return org;
  }

  async findAllOrgs(): Promise<Org[]> {
    return await this.orgRepository.find({
      relations: ['campuses'],
      order: { created_at: 'DESC' }
    });
  }

  async updateOrg(orgId: number, updateOrgDto: UpdateOrgDto, actorUserId: number): Promise<Org> {
    const existingOrg = await this.findOrgById(orgId);

    // Check for duplicate name or code (excluding current org)
    if (updateOrgDto.name || updateOrgDto.code) {
      const duplicateOrg = await this.orgRepository.findOne({
        where: [
          { name: updateOrgDto.name },
          { code: updateOrgDto.code }
        ]
      });

      if (duplicateOrg && duplicateOrg.org_id !== orgId) {
        if (duplicateOrg.name === updateOrgDto.name) {
          throw new ConflictException('Organization name already exists');
        }
        if (duplicateOrg.code === updateOrgDto.code) {
          throw new ConflictException('Organization code already exists');
        }
      }
    }

    const previousData = { ...existingOrg };
    Object.assign(existingOrg, updateOrgDto);

    const updatedOrg = await this.orgRepository.save(existingOrg);

    await this.createAuditLog({
      org_id: updatedOrg.org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: updatedOrg.org_id,
      action: ChangeAction.UPDATE,
      diff_json: {
        previous: previousData,
        updated: updateOrgDto
      }
    });

    return updatedOrg;
  }

  async deleteOrg(orgId: number, actorUserId: number): Promise<void> {
    const org = await this.findOrgById(orgId);

    // Check if org has campuses
    if (org.campuses && org.campuses.length > 0) {
      throw new ConflictException('Cannot delete organization with existing campuses');
    }

    await this.orgRepository.remove(org);

    await this.createAuditLog({
      org_id: orgId,
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: orgId,
      action: ChangeAction.DELETE,
      diff_json: { deleted: org }
    });
  }

  private async createAuditLog(auditData: Partial<AuditLog>): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(auditData);
    return await this.auditLogRepository.save(auditLog);
  }
}