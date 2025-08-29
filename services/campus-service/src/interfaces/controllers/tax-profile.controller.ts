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
import { ApiResponse as ApiResponseType, ResponseHelper } from '@eduhub/shared';
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
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Tax profile created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '税务配置创建成功' },
        data: {
          type: 'object',
          properties: {
            tax_profile_id: { type: 'number', example: 1 },
            created_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  async create(
    @Body(ValidationPipe) createTaxProfileDto: CreateTaxProfileDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ tax_profile_id: number; created_at: Date }>> {
    const taxProfile = await this.taxProfileService.createTaxProfile(user.org_id, createTaxProfileDto, user.user_id);

    return ResponseHelper.created({
      tax_profile_id: taxProfile.tax_profile_id,
      created_at: taxProfile.created_at
    }, '税务配置创建成功');
  }

  @Get(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get tax profile by ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Tax profile found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '税务配置获取成功' },
        data: {
          type: 'object',
          properties: {
            tax_profile_id: { type: 'number', example: 1 },
            name: { type: 'string', example: '标准税务配置' },
            tax_rate: { type: 'number', example: 0.13 },
            deduction_amount: { type: 'number', example: 3500.00 },
            social_security_rate: { type: 'number', example: 0.22 },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  })
  async findById(
    @Param('id', ParseIntPipe) taxProfileId: number
  ): Promise<ApiResponseType<any>> {
    const taxProfile = await this.taxProfileService.findTaxProfileById(taxProfileId);
    
    return ResponseHelper.found(taxProfile, '税务配置获取成功');
  }

  @Get()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get all tax profiles' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Tax profiles retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '税务配置列表获取成功' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  tax_profile_id: { type: 'number', example: 1 },
                  name: { type: 'string', example: '标准税务配置' },
                  tax_rate: { type: 'number', example: 0.13 },
                  deduction_amount: { type: 'number', example: 3500.00 },
                  social_security_rate: { type: 'number', example: 0.22 },
                  created_at: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    }
  })
  async findAll(): Promise<ApiResponseType<any>> {
    const taxProfiles = await this.taxProfileService.findAllTaxProfiles();
    
    return ResponseHelper.found({ items: taxProfiles }, '税务配置列表获取成功');
  }

  @Patch(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE)
  @ApiOperation({ summary: 'Update tax profile' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Tax profile updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '税务配置更新成功' },
        data: {
          type: 'object',
          properties: {
            updated: { type: 'boolean', example: true },
            updated_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  async update(
    @Param('id', ParseIntPipe) taxProfileId: number,
    @Body(ValidationPipe) updateTaxProfileDto: UpdateTaxProfileDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ updated: boolean; updated_at: Date }>> {
    const taxProfile = await this.taxProfileService.updateTaxProfile(user.org_id, taxProfileId, updateTaxProfileDto, user.user_id);

    return ResponseHelper.updated({
      updated: true,
      updated_at: taxProfile.updated_at
    }, '税务配置更新成功');
  }

  @Delete(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.FINANCE)
  @ApiOperation({ summary: 'Delete tax profile' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Tax profile deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '税务配置删除成功' },
        data: {
          type: 'object',
          properties: {
            deleted: { type: 'boolean', example: true }
          }
        }
      }
    }
  })
  async delete(
    @Param('id', ParseIntPipe) taxProfileId: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ deleted: boolean }>> {
    await this.taxProfileService.deleteTaxProfile(user.org_id, taxProfileId, user.user_id);

    return ResponseHelper.deleted('税务配置删除成功');
  }
}