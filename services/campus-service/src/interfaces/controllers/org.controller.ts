import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
  UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OrgService } from '../../application/services/org.service';
import { CreateOrgDto, UpdateOrgDto } from '../dto/create-org.dto';
import { ApiResponse as ApiResponseType } from '@eduhub/shared';
import { JwtAuthGuard, RolesGuard, Roles, USER_ROLES, CurrentUser, AuthenticatedUser } from '@eduhub/shared';

@ApiTags('Organizations')
@Controller('orgs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Post()
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Organization created successfully' })
  async create(
    @Body(ValidationPipe) createOrgDto: CreateOrgDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ org_id: number; created_at: Date }>> {
    const org = await this.orgService.createOrg(createOrgDto, user.user_id);

    return {
      data: {
        org_id: org.org_id,
        created_at: org.created_at
      }
    };
  }

  @Get(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Organization found' })
  async findById(
    @Param('id', ParseIntPipe) orgId: number
  ): Promise<ApiResponseType<any>> {
    const org = await this.orgService.findOrgById(orgId);
    
    return { data: org };
  }

  @Get()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Organizations retrieved successfully' })
  async findAll(): Promise<ApiResponseType<any>> {
    const orgs = await this.orgService.findAllOrgs();
    
    return { data: { items: orgs } };
  }

  @Patch(':id')
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Organization updated successfully' })
  async update(
    @Param('id', ParseIntPipe) orgId: number,
    @Body(ValidationPipe) updateOrgDto: UpdateOrgDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ updated: boolean; updated_at: Date }>> {
    const org = await this.orgService.updateOrg(orgId, updateOrgDto, user.user_id);

    return {
      data: {
        updated: true,
        updated_at: org.updated_at
      }
    };
  }

  @Delete(':id')
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Organization deleted successfully' })
  async delete(
    @Param('id', ParseIntPipe) orgId: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ deleted: boolean }>> {
    await this.orgService.deleteOrg(orgId, user.user_id);

    return {
      data: { deleted: true }
    };
  }
}