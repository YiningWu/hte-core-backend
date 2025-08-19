import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { Role } from '../../domain/entities/role.entity';
import { AuditLog } from '../../domain/entities/audit-log.entity';
import { CreateUserDto } from '../../interfaces/dto/create-user.dto';
import { UpdateUserDto } from '../../interfaces/dto/update-user.dto';
import { QueryUserDto } from '../../interfaces/dto/query-user.dto';
import { PaginationResponse, EntityType, ChangeAction } from '@eduhub/shared';
import { MessageBrokerService } from '@eduhub/shared';
import { DOMAIN_EVENTS, UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent } from '@eduhub/shared';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly messageBroker: MessageBrokerService
  ) {}

  async create(createUserDto: CreateUserDto, actorUserId: number, requestId?: string): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: [
        { username: createUserDto.username },
        { email: createUserDto.email },
        { phone: createUserDto.phone },
        { id_card_no: createUserDto.id_card_no }
      ]
    });

    if (existingUser) {
      if (existingUser.username === createUserDto.username) {
        throw new ConflictException('Username already exists');
      }
      if (existingUser.email === createUserDto.email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.phone === createUserDto.phone) {
        throw new ConflictException('Phone already exists');
      }
      if (existingUser.id_card_no === createUserDto.id_card_no) {
        throw new ConflictException('ID card number already exists');
      }
    }

    const user = this.userRepository.create({
      ...createUserDto,
      hire_date: new Date(createUserDto.hire_date)
    });

    const savedUser = await this.userRepository.save(user);

    await this.createAuditLog({
      org_id: savedUser.org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.USER,
      entity_id: savedUser.user_id,
      action: ChangeAction.CREATE,
      diff_json: { created: createUserDto },
      request_id: requestId
    });

    // Publish domain event
    await this.messageBroker.publishMessage({
      eventType: DOMAIN_EVENTS.USER_CREATED,
      aggregateId: savedUser.user_id.toString(),
      aggregateType: 'User',
      orgId: savedUser.org_id,
      payload: {
        userId: savedUser.user_id,
        username: savedUser.username,
        email: savedUser.email,
        firstName: savedUser.username.split(' ')[0] || savedUser.username,
        lastName: savedUser.username.split(' ')[1] || '',
        roles: [savedUser.role].filter(Boolean)
      },
      version: 1,
      correlationId: requestId
    });

    return savedUser;
  }

  async findById(userId: number, orgId: number): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { user_id: userId, org_id: orgId }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findAll(orgId: number, queryDto: QueryUserDto): Promise<PaginationResponse<User>> {
    const { q, status, campus_id, page_size = 20, cursor } = queryDto;

    const queryBuilder = this.userRepository.createQueryBuilder('user')
      .where('user.org_id = :orgId', { orgId });

    if (q) {
      queryBuilder.andWhere(
        '(user.username LIKE :search OR user.email LIKE :search OR user.phone LIKE :search)',
        { search: `%${q}%` }
      );
    }

    if (status) {
      queryBuilder.andWhere('user.employment_status = :status', { status });
    }

    if (campus_id) {
      queryBuilder.andWhere('user.campus_id = :campusId', { campusId: campus_id });
    }

    if (cursor) {
      try {
        const decodedCursor = Buffer.from(cursor, 'base64').toString();
        const parsedCursor = JSON.parse(decodedCursor);
        queryBuilder.andWhere('user.user_id > :cursorId', { cursorId: parsedCursor.user_id });
      } catch (error) {
        throw new BadRequestException('Invalid cursor');
      }
    }

    queryBuilder
      .orderBy('user.user_id', 'ASC')
      .limit(page_size + 1);

    const users = await queryBuilder.getMany();
    const hasNextPage = users.length > page_size;

    if (hasNextPage) {
      users.pop();
    }

    let nextCursor: string | undefined;
    if (hasNextPage && users.length > 0) {
      const lastUser = users[users.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ user_id: lastUser.user_id })).toString('base64');
    }

    const total = await queryBuilder.getCount();

    return {
      items: users.map(user => user.maskSensitiveData() as User),
      next_cursor: nextCursor,
      total
    };
  }

  async update(userId: number, orgId: number, updateUserDto: UpdateUserDto, actorUserId: number, requestId?: string): Promise<User> {
    const existingUser = await this.findById(userId, orgId);

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.userRepository.findOne({
        where: { email: updateUserDto.email, user_id: userId }
      });
      if (emailExists) {
        throw new ConflictException('Email already exists');
      }
    }

    if (updateUserDto.phone && updateUserDto.phone !== existingUser.phone) {
      const phoneExists = await this.userRepository.findOne({
        where: { phone: updateUserDto.phone, user_id: userId }
      });
      if (phoneExists) {
        throw new ConflictException('Phone already exists');
      }
    }

    const previousData = { ...existingUser };
    Object.assign(existingUser, updateUserDto);

    const updatedUser = await this.userRepository.save(existingUser);

    await this.createAuditLog({
      org_id: updatedUser.org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.USER,
      entity_id: updatedUser.user_id,
      action: ChangeAction.UPDATE,
      diff_json: {
        previous: previousData,
        updated: updateUserDto,
        reason: updateUserDto.change_reason
      },
      request_id: requestId
    });

    return updatedUser;
  }

  async delete(userId: number, orgId: number, actorUserId: number, requestId?: string): Promise<void> {
    const user = await this.findById(userId, orgId);

    await this.userRepository.remove(user);

    await this.createAuditLog({
      org_id: user.org_id,
      actor_user_id: actorUserId,
      entity_type: EntityType.USER,
      entity_id: userId,
      action: ChangeAction.DELETE,
      diff_json: { deleted: user },
      request_id: requestId
    });
  }

  async getChangeHistory(userId: number, orgId: number, from?: string, to?: string): Promise<AuditLog[]> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit')
      .where('audit.entity_type = :entityType', { entityType: EntityType.USER })
      .andWhere('audit.entity_id = :entityId', { entityId: userId })
      .andWhere('audit.org_id = :orgId', { orgId });

    if (from) {
      queryBuilder.andWhere('audit.created_at >= :from', { from: new Date(from) });
    }

    if (to) {
      queryBuilder.andWhere('audit.created_at <= :to', { to: new Date(to) });
    }

    return await queryBuilder
      .orderBy('audit.created_at', 'DESC')
      .getMany();
  }

  private async createAuditLog(auditData: Partial<AuditLog>): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(auditData);
    return await this.auditLogRepository.save(auditLog);
  }
}