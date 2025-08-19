import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Campus } from '../../domain/entities/campus.entity';
import { Classroom } from '../../domain/entities/classroom.entity';
import { CampusBillingProfile } from '../../domain/entities/campus-billing-profile.entity';
import { CreateCampusDto } from '../../interfaces/dto/create-campus.dto';
import { CreateClassroomDto } from '../../interfaces/dto/create-classroom.dto';
import { CreateBillingProfileDto } from '../../interfaces/dto/create-billing-profile.dto';

@Injectable()
export class CampusService {
  constructor(
    @InjectRepository(Campus)
    private readonly campusRepository: Repository<Campus>,
    @InjectRepository(Classroom)
    private readonly classroomRepository: Repository<Classroom>,
    @InjectRepository(CampusBillingProfile)
    private readonly billingProfileRepository: Repository<CampusBillingProfile>
  ) {}

  async createCampus(createCampusDto: CreateCampusDto): Promise<Campus> {
    const existingCampus = await this.campusRepository.findOne({
      where: { code: createCampusDto.code }
    });

    if (existingCampus) {
      throw new ConflictException('Campus code already exists');
    }

    const campus = this.campusRepository.create({
      ...createCampusDto,
      open_date: createCampusDto.open_date ? new Date(createCampusDto.open_date) : null
    });

    return await this.campusRepository.save(campus);
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

  async findAllCampuses(orgId: number): Promise<Campus[]> {
    return await this.campusRepository.find({
      where: { org_id: orgId },
      relations: ['classrooms'],
      order: { created_at: 'DESC' }
    });
  }

  async createClassroom(campusId: number, orgId: number, createClassroomDto: CreateClassroomDto): Promise<Classroom> {
    const campus = await this.findCampusById(campusId, orgId);

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

    return await this.classroomRepository.save(classroom);
  }

  async createBillingProfile(campusId: number, orgId: number, createBillingProfileDto: CreateBillingProfileDto): Promise<CampusBillingProfile> {
    const campus = await this.findCampusById(campusId, orgId);

    const billingProfile = this.billingProfileRepository.create({
      ...createBillingProfileDto,
      campus_id: campusId
    });

    return await this.billingProfileRepository.save(billingProfile);
  }

  async updateCampus(campusId: number, orgId: number, updateData: Partial<CreateCampusDto>): Promise<Campus> {
    const campus = await this.findCampusById(campusId, orgId);

    if (updateData.code && updateData.code !== campus.code) {
      const existingCampus = await this.campusRepository.findOne({
        where: { code: updateData.code }
      });
      if (existingCampus) {
        throw new ConflictException('Campus code already exists');
      }
    }

    Object.assign(campus, updateData);

    if (updateData.open_date) {
      campus.open_date = new Date(updateData.open_date);
    }

    return await this.campusRepository.save(campus);
  }

  async deleteCampus(campusId: number, orgId: number): Promise<void> {
    const campus = await this.findCampusById(campusId, orgId);
    await this.campusRepository.remove(campus);
  }
}