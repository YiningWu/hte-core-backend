import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger';
import { JwtAuthGuard, Roles, RolesGuard, CurrentUser } from '@eduhub/shared';
import { LedgerCategoryService } from '../../application/services/ledger-category.service';
import { CreateLedgerCategoryDto } from '../dto/create-ledger-category.dto';
import { EntryType } from '../../domain/enums/billing.enum';

@ApiTags('类目管理')
@ApiBearerAuth()
@Controller('core/billing/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerCategoriesController {
  constructor(private readonly categoryService: LedgerCategoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('super_admin', 'principal', 'finance')
  @ApiOperation({ summary: '创建类目' })
  @ApiResponse({ status: 201, description: '类目创建成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 409, description: '类目代码冲突' })
  async create(
    @Body() createDto: CreateLedgerCategoryDto,
    @CurrentUser() user: any
  ) {
    const category = await this.categoryService.create(createDto, user.orgId);
    return {
      categoryId: category.categoryId,
      createdAt: category.createdAt
    };
  }

  @Get()
  @Roles('super_admin', 'principal', 'finance', 'auditor', 'teacher')
  @ApiOperation({ summary: '获取类目列表' })
  @ApiQuery({ name: 'type', required: false, enum: EntryType, description: '类型' })
  @ApiQuery({ name: 'isActive', required: false, description: '是否激活' })
  @ApiQuery({ name: 'q', required: false, description: '搜索关键词' })
  async findAll(
    @Query('type') type?: EntryType,
    @Query('isActive') isActive?: boolean,
    @Query('q') q?: string,
    @CurrentUser() user?: any
  ) {
    const categories = await this.categoryService.findAll(user.orgId, {
      type,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      q
    });

    return {
      items: categories,
      total: categories.length
    };
  }

  @Get(':categoryId')
  @Roles('super_admin', 'principal', 'finance', 'auditor', 'teacher')
  @ApiOperation({ summary: '获取类目详情' })
  @ApiParam({ name: 'categoryId', description: '类目ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '类目不存在' })
  async findOne(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: any
  ) {
    return await this.categoryService.findById(Number(categoryId), user.orgId);
  }

  @Patch(':categoryId')
  @Roles('super_admin', 'principal', 'finance')
  @ApiOperation({ summary: '更新类目' })
  @ApiParam({ name: 'categoryId', description: '类目ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '类目不存在' })
  async update(
    @Param('categoryId') categoryId: string,
    @Body() updateDto: Partial<CreateLedgerCategoryDto>,
    @CurrentUser() user: any
  ) {
    const category = await this.categoryService.update(Number(categoryId), user.orgId, updateDto);
    return {
      updated: true,
      updatedAt: category.updatedAt
    };
  }

  @Delete(':categoryId')
  @Roles('super_admin', 'principal')
  @ApiOperation({ summary: '停用类目' })
  @ApiParam({ name: 'categoryId', description: '类目ID' })
  @ApiResponse({ status: 200, description: '停用成功' })
  async deactivate(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: any
  ) {
    await this.categoryService.deactivate(Number(categoryId), user.orgId);
    return { deactivated: true };
  }

  @Post(':categoryId/activate')
  @Roles('super_admin', 'principal')
  @ApiOperation({ summary: '启用类目' })
  @ApiParam({ name: 'categoryId', description: '类目ID' })
  @ApiResponse({ status: 200, description: '启用成功' })
  async activate(
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: any
  ) {
    await this.categoryService.activate(Number(categoryId), user.orgId);
    return { activated: true };
  }

  @Post('initialize-defaults')
  @Roles('super_admin', 'principal')
  @ApiOperation({ summary: '初始化默认类目' })
  @ApiResponse({ status: 200, description: '初始化成功' })
  async initializeDefaults(@CurrentUser() user: any) {
    await this.categoryService.initializeDefaultCategories(user.orgId);
    return { initialized: true };
  }
}