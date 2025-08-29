import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campus } from '../../domain/entities/campus.entity';
import { Classroom } from '../../domain/entities/classroom.entity';
import { CampusBillingProfile } from '../../domain/entities/campus-billing-profile.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { CreateCampusDto } from '../../interfaces/dto/create-campus.dto';
import { CreateClassroomDto } from '../../interfaces/dto/create-classroom.dto';
import { CreateBillingProfileDto } from '../../interfaces/dto/create-billing-profile.dto';
import { ServiceClient, PaginationResponse, EntityType, ChangeAction } from '@eduhub/shared';
import { QueryCampusDto } from '../../interfaces/dto/query-campus.dto';

@Injectable()
export class CampusService {
  constructor(
    @InjectRepository(Campus)
    private readonly campusRepository: Repository<Campus>,
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
    @InjectRepository(CampusBillingProfile)
    private readonly billingProfileRepository: Repository<CampusBillingProfile>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly serviceClient: ServiceClient
  ) {}

  private async createAuditLog(data: Partial<AuditLog>): Promise<AuditLog> {
    const log = this.auditLogRepository.create(data);
    return this.auditLogRepository.save(log);
  }

  async createCampus(createCampusDto: CreateCampusDto, actorUserId: number): Promise<Campus> {
    const existingCampus = await this.campusRepository.findOne({
      where: { code: createCampusDto.code }
    });

    if (existingCampus) {
      throw new ConflictException('Campus code already exists');
    }

    // Validate principal user if provided
    if (createCampusDto.principal_user_id) {
      await this.validateUser(createCampusDto.principal_user_id, createCampusDto.org_id);
    }

    const campus = this.campusRepository.create({
      ...createCampusDto,
      open_date: createCampusDto.open_date ? new Date(createCampusDto.open_date) : null
    });

    const savedCampus = await this.campusRepository.save(campus);

    await this.createAuditLog({
      org_id: savedCampus.org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: savedCampus.campus_id,
      action: ChangeAction.CREATE,
      diff_json: { created: createCampusDto }
    });

    return savedCampus;
  }

  async findCampusById(campusId: number, orgId: number): Promise<Campus> {
    const campus = await this.campusRepository.findOne({
      where: { campus_id: campusId, org_id: orgId },
      relations: ['classrooms', 'billing_profiles']
    });

    if (!campus) {
      throw new NotFoundException('Campus not found');
    }

    return campus;
  }

  async findAllCampuses(orgId: number, queryDto: QueryCampusDto): Promise<PaginationResponse<Campus>> {
    const { q, status, page_size = 20, cursor } = queryDto;

    const queryBuilder = this.campusRepository.createQueryBuilder('campus')
      .where('campus.org_id = :orgId', { orgId });

    if (q) {
      queryBuilder.andWhere(
        '(campus.name LIKE :search OR campus.code LIKE :search OR campus.city LIKE :search)',
        { search: `%${q}%` }
      );
    }

    if (status) {
      queryBuilder.andWhere('campus.status = :status', { status });
    }

    if (cursor) {
      try {
        const decoded = Buffer.from(cursor, 'base64').toString();
        const parsed = JSON.parse(decoded);
        queryBuilder.andWhere('campus.campus_id > :cursorId', { cursorId: parsed.campus_id });
      } catch (error) {
        throw new BadRequestException('Invalid cursor');
      }
    }

    const total = await queryBuilder.getCount();

    queryBuilder.orderBy('campus.campus_id', 'ASC').limit(page_size + 1);

    const campuses = await queryBuilder.getMany();
    const hasNext = campuses.length > page_size;
    if (hasNext) {
      campuses.pop();
    }

    let nextCursor: string | undefined;
    if (hasNext && campuses.length > 0) {
      const last = campuses[campuses.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ campus_id: last.campus_id })).toString('base64');
    }

    return {
      items: campuses,
      next_cursor: nextCursor,
      total
    };
  }

  async createClassroom(
    campusId: number,
    orgId: number,
    createClassroomDto: CreateClassroomDto,
    actorUserId: number
  ): Promise<Classroom> {
    await this.findCampusById(campusId, orgId);

    const existingClassroom = await this.classroomRepository.findOne({
      where: { code: createClassroomDto.code }
    });

    if (existingClassroom) {
      throw new ConflictException('Classroom code already exists');
    }

    const classroom = this.classroomRepository.create({
      ...createClassroomDto,
      campus_id: campusId
    });

    const savedClassroom = await this.classroomRepository.save(classroom);

    await this.createAuditLog({
      org_id: orgId,
      actor_user_id: actorUserId,
      entity_type: EntityType.CLASSROOM,
      entity_id: savedClassroom.classroom_id,
      action: ChangeAction.CREATE,
      diff_json: { created: createClassroomDto, campus_id: campusId }
    });

    return savedClassroom;
  }

  async createBillingProfile(
    campusId: number,
    orgId: number,
    createBillingProfileDto: CreateBillingProfileDto,
    actorUserId: number
  ): Promise<CampusBillingProfile> {
    await this.findCampusById(campusId, orgId);

    const billingProfile = this.billingProfileRepository.create({
      ...createBillingProfileDto,
      campus_id: campusId
    });

    const savedProfile = await this.billingProfileRepository.save(billingProfile);

    await this.createAuditLog({
      org_id: orgId,
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: campusId,
      action: ChangeAction.CREATE,
      diff_json: { created: createBillingProfileDto, billing_profile_id: savedProfile.id }
    });

    return savedProfile;
  }

  async updateCampus(
    campusId: number,
    orgId: number,
    updateData: Partial<CreateCampusDto>,
    actorUserId: number
  ): Promise<Campus> {
    const campus = await this.findCampusById(campusId, orgId);

    if (updateData.code && updateData.code !== campus.code) {
      const existingCampus = await this.campusRepository.findOne({
        where: { code: updateData.code }
      });
      if (existingCampus) {
        throw new ConflictException('Campus code already exists');
      }
    }

    const previousData = { ...campus };

    // Validate principal user if being updated
    if (updateData.principal_user_id && updateData.principal_user_id !== campus.principal_user_id) {
      await this.validateUser(updateData.principal_user_id, orgId);
    }

    Object.assign(campus, updateData);

    if (updateData.open_date) {
      campus.open_date = new Date(updateData.open_date);
    }

    const updatedCampus = await this.campusRepository.save(campus);

    await this.createAuditLog({
      org_id: orgId,
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: updatedCampus.campus_id,
      action: ChangeAction.UPDATE,
      diff_json: { previous: previousData, updated: updateData }
    });

    return updatedCampus;
  }

  async deleteCampus(campusId: number, orgId: number, actorUserId: number): Promise<void> {
    const campus = await this.findCampusById(campusId, orgId);
    await this.campusRepository.remove(campus);

    await this.createAuditLog({
      org_id: orgId,
      actor_user_id: actorUserId,
      entity_type: EntityType.CAMPUS,
      entity_id: campusId,
      action: ChangeAction.DELETE,
      diff_json: { deleted: campus }
    });
  }

  private async validateUser(userId: number, orgId: number): Promise<void> {
    try {
      // Use the service client's built-in method
      // Note: In production, we would get the auth token from the request context
      const authToken = 'internal-service-token'; // For service-to-service communication
      const user = await this.serviceClient.validateUser(userId, orgId, authToken);

      if (!user) {
        throw new BadRequestException(`User ${userId} not found or not accessible`);
      }

      // Check if user belongs to the same organization
      if (user.data?.org_id !== orgId) {
        throw new BadRequestException(`User ${userId} does not belong to organization ${orgId}`);
      }

      // Check if user is active
      if (user.data?.employment_status !== 'ACTIVE') {
        throw new BadRequestException(`User ${userId} is not active (status: ${user.data?.employment_status})`);
      }
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // For other network errors, log and throw a generic error
      console.error(`Failed to validate user ${userId}:`, error.message);
      throw new BadRequestException(`Unable to validate user ${userId}. Please ensure the user service is available.`);
    }
  }
}