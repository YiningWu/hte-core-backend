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
import { TaxProfileService } from '../../application/services/tax-profile.service';
import { CreateTaxProfileDto, UpdateTaxProfileDto } from '../dto/create-tax-profile.dto';
import { ApiResponse as ApiResponseType } from '@eduhub/shared';
import { JwtAuthGuard, RolesGuard, Roles, USER_ROLES, CurrentUser, AuthenticatedUser } from '@eduhub/shared';

@ApiTags('Tax Profiles')
@Controller('tax-profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaxProfileController {
  constructor(private readonly taxProfileService: TaxProfileService) {}

  @Post()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE)
  @ApiOperation({ summary: 'Create a new tax profile' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Tax profile created successfully' })
  async create(
    @Body(ValidationPipe) createTaxProfileDto: CreateTaxProfileDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ tax_profile_id: number; created_at: Date }>> {
    const taxProfile = await this.taxProfileService.createTaxProfile(createTaxProfileDto, user.user_id);

    return {
      data: {
        tax_profile_id: taxProfile.tax_profile_id,
        created_at: taxProfile.created_at
      }
    };
  }

  @Get(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get tax profile by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tax profile found' })
  async findById(
    @Param('id', ParseIntPipe) taxProfileId: number
  ): Promise<ApiResponseType<any>> {
    const taxProfile = await this.taxProfileService.findTaxProfileById(taxProfileId);
    
    return { data: taxProfile };
  }

  @Get()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get all tax profiles' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tax profiles retrieved successfully' })
  async findAll(): Promise<ApiResponseType<any>> {
    const taxProfiles = await this.taxProfileService.findAllTaxProfiles();
    
    return { data: { items: taxProfiles } };
  }

  @Patch(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE)
  @ApiOperation({ summary: 'Update tax profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tax profile updated successfully' })
  async update(
    @Param('id', ParseIntPipe) taxProfileId: number,
    @Body(ValidationPipe) updateTaxProfileDto: UpdateTaxProfileDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ updated: boolean; updated_at: Date }>> {
    const taxProfile = await this.taxProfileService.updateTaxProfile(taxProfileId, updateTaxProfileDto, user.user_id);

    return {
      data: {
        updated: true,
        updated_at: taxProfile.updated_at
      }
    };
  }

  @Delete(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE)
  @ApiOperation({ summary: 'Delete tax profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tax profile deleted successfully' })
  async delete(
    @Param('id', ParseIntPipe) taxProfileId: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ deleted: boolean }>> {
    await this.taxProfileService.deleteTaxProfile(taxProfileId, user.user_id);

    return {
      data: { deleted: true }
    };
  }
}