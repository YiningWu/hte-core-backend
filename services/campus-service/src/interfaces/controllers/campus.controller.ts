import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Headers,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { CampusService } from '../../application/services/campus.service';
import { CreateCampusDto } from '../dto/create-campus.dto';
import { CreateClassroomDto } from '../dto/create-classroom.dto';
import { CreateBillingProfileDto } from '../dto/create-billing-profile.dto';
import { ApiResponse as ApiResponseType, JwtAuthGuard } from '@eduhub/shared';

@ApiTags('Campuses')
@Controller('campuses')
@ApiHeader({ name: 'Authorization', description: 'Bearer token' })
@ApiHeader({ name: 'X-Request-Id', description: 'Request ID for idempotency' })
@ApiHeader({ name: 'X-Org-Id', description: 'Organization ID' })
export class CampusController {
  constructor(private readonly campusService: CampusService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new campus' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Campus created successfully' })
  async create(
    @Body(ValidationPipe) createCampusDto: CreateCampusDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<{ campus_id: number; created_at: Date }>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const campus = await this.campusService.createCampus({
      ...createCampusDto,
      org_id: parseInt(orgId)
    });

    return {
      data: {
        campus_id: campus.campus_id,
        created_at: campus.created_at
      }
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campus by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campus found' })
  async findById(
    @Param('id', ParseIntPipe) campusId: number,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<any>> {
    const campus = await this.campusService.findCampusById(campusId, parseInt(orgId));
    
    return { data: campus };
  }

  @Get()
  @ApiOperation({ summary: 'Get all campuses for organization' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campuses retrieved successfully' })
  async findAll(
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<any>> {
    if (!orgId) {
      orgId = '1'; // Default org_id for testing
    }
    const campuses = await this.campusService.findAllCampuses(parseInt(orgId));
    
    return { data: { items: campuses } };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update campus' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campus updated successfully' })
  async update(
    @Param('id', ParseIntPipe) campusId: number,
    @Body(ValidationPipe) updateData: Partial<CreateCampusDto>,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<{ updated: boolean; updated_at: Date }>> {
    const campus = await this.campusService.updateCampus(campusId, parseInt(orgId), updateData);

    return {
      data: {
        updated: true,
        updated_at: campus.updated_at
      }
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete campus' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Campus deleted successfully' })
  async delete(
    @Param('id', ParseIntPipe) campusId: number,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<{ deleted: boolean }>> {
    await this.campusService.deleteCampus(campusId, parseInt(orgId));

    return {
      data: { deleted: true }
    };
  }

  @Post(':id/classrooms')
  @ApiOperation({ summary: 'Create classroom for campus' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Classroom created successfully' })
  async createClassroom(
    @Param('id', ParseIntPipe) campusId: number,
    @Body(ValidationPipe) createClassroomDto: CreateClassroomDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<{ classroom_id: number }>> {
    const classroom = await this.campusService.createClassroom(campusId, parseInt(orgId), createClassroomDto);

    return {
      data: { classroom_id: classroom.classroom_id }
    };
  }

  @Post(':id/billing-profiles')
  @ApiOperation({ summary: 'Create billing profile for campus' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Billing profile created successfully' })
  async createBillingProfile(
    @Param('id', ParseIntPipe) campusId: number,
    @Body(ValidationPipe) createBillingProfileDto: CreateBillingProfileDto,
    @Headers('X-Org-Id') orgId: string
  ): Promise<ApiResponseType<{ id: number; created_at: Date }>> {
    const profile = await this.campusService.createBillingProfile(campusId, parseInt(orgId), createBillingProfileDto);

    return {
      data: {
        id: profile.id,
        created_at: profile.created_at
      }
    };
  }
}