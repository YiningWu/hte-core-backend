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
import { ApiResponse as ApiResponseType, ResponseHelper } from '@eduhub/shared';
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
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Organization created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '组织创建成功' },
        data: {
          type: 'object',
          properties: {
            org_id: { type: 'number', example: 1 },
            created_at: { type: 'string', format: 'date-time', example: '2024-01-01T12:00:00.000Z' }
          }
        }
      }
    }
  })
  async create(
    @Body(ValidationPipe) createOrgDto: CreateOrgDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ org_id: number; created_at: Date }>> {
    const org = await this.orgService.createOrg(createOrgDto, user.user_id);

    return ResponseHelper.created({
      org_id: org.org_id,
      created_at: org.created_at
    }, '组织创建成功');
  }

  @Get(':id')
  @Roles(USER_ROLES.ADMIN, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Organization found',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '组织信息获取成功' },
        data: {
          type: 'object',
          properties: {
            org_id: { type: 'number', example: 1 },
            name: { type: 'string', example: 'Example Organization' },
            code: { type: 'string', example: 'ORG001' },
            type: { type: 'string', example: 'ENTERPRISE' },
            status: { type: 'string', example: 'ACTIVE' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        }
      }
    }
  })
  async findById(
    @Param('id', ParseIntPipe) orgId: number
  ): Promise<ApiResponseType<any>> {
    const org = await this.orgService.findOrgById(orgId);
    
    return ResponseHelper.found(org, '组织信息获取成功');
  }

  @Get()
  @Roles(USER_ROLES.ADMIN, USER_ROLES.HR)
  @ApiOperation({ summary: 'Get all organizations' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Organizations retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '组织列表获取成功' },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  org_id: { type: 'number', example: 1 },
                  name: { type: 'string', example: 'Example Organization' },
                  code: { type: 'string', example: 'ORG001' },
                  type: { type: 'string', example: 'ENTERPRISE' },
                  status: { type: 'string', example: 'ACTIVE' },
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
    const orgs = await this.orgService.findAllOrgs();
    
    return ResponseHelper.found({ items: orgs }, '组织列表获取成功');
  }

  @Patch(':id')
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Organization updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '组织更新成功' },
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
    @Param('id', ParseIntPipe) orgId: number,
    @Body(ValidationPipe) updateOrgDto: UpdateOrgDto,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ updated: boolean; updated_at: Date }>> {
    const org = await this.orgService.updateOrg(orgId, updateOrgDto, user.user_id);

    return ResponseHelper.updated({
      updated: true,
      updated_at: org.updated_at
    }, '组织更新成功');
  }

  @Delete(':id')
  @Roles(USER_ROLES.ADMIN)
  @ApiOperation({ summary: 'Delete organization' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Organization deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: '组织删除成功' },
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
    @Param('id', ParseIntPipe) orgId: number,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ApiResponseType<{ deleted: boolean }>> {
    await this.orgService.deleteOrg(orgId, user.user_id);

    return ResponseHelper.deleted('组织删除成功');
  }
}