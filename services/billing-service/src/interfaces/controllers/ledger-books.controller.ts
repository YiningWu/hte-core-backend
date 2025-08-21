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
  Request,
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
import { LedgerBookService } from '../../application/services/ledger-book.service';
import { CreateLedgerBookDto } from '../dto/create-ledger-book.dto';
import { LedgerBookStatus } from '../../domain/enums/billing.enum';

@ApiTags('账本管理')
@ApiBearerAuth()
@Controller('core/billing/books')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LedgerBooksController {
  constructor(private readonly ledgerBookService: LedgerBookService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('super_admin', 'principal', 'finance')
  @ApiOperation({ summary: '创建账本' })
  @ApiResponse({ status: 201, description: '账本创建成功' })
  @ApiResponse({ status: 400, description: '参数错误' })
  @ApiResponse({ status: 409, description: '账本编码冲突' })
  async create(
    @Body() createDto: CreateLedgerBookDto,
    @CurrentUser() user: any
  ) {
    const book = await this.ledgerBookService.create(createDto, user.orgId);
    return {
      bookId: book.bookId,
      createdAt: book.createdAt
    };
  }

  @Get()
  @Roles('super_admin', 'principal', 'finance', 'auditor')
  @ApiOperation({ summary: '获取账本列表' })
  @ApiQuery({ name: 'campusId', required: false, description: '校区ID' })
  @ApiQuery({ name: 'status', required: false, enum: LedgerBookStatus, description: '状态' })
  @ApiQuery({ name: 'q', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页数量', example: 20 })
  @ApiQuery({ name: 'cursor', required: false, description: '游标分页' })
  async findAll(
    @Query('campusId') campusId?: number,
    @Query('status') status?: LedgerBookStatus,
    @Query('q') q?: string,
    @Query('pageSize') pageSize?: number,
    @Query('cursor') cursor?: string,
    @CurrentUser() user?: any
  ) {
    return await this.ledgerBookService.findAll(user.orgId, {
      campusId: campusId ? Number(campusId) : undefined,
      status,
      q,
      pageSize: pageSize ? Number(pageSize) : undefined,
      cursor
    });
  }

  @Get(':bookId')
  @Roles('super_admin', 'principal', 'finance', 'auditor')
  @ApiOperation({ summary: '获取账本详情' })
  @ApiParam({ name: 'bookId', description: '账本ID' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @ApiResponse({ status: 404, description: '账本不存在' })
  async findOne(
    @Param('bookId') bookId: string,
    @CurrentUser() user: any
  ) {
    return await this.ledgerBookService.findById(Number(bookId), user.orgId);
  }

  @Patch(':bookId')
  @Roles('super_admin', 'principal', 'finance')
  @ApiOperation({ summary: '更新账本' })
  @ApiParam({ name: 'bookId', description: '账本ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @ApiResponse({ status: 404, description: '账本不存在' })
  async update(
    @Param('bookId') bookId: string,
    @Body() updateDto: Partial<CreateLedgerBookDto>,
    @CurrentUser() user: any
  ) {
    const book = await this.ledgerBookService.update(Number(bookId), user.orgId, updateDto);
    return {
      updated: true,
      updatedAt: book.updatedAt
    };
  }

  @Delete(':bookId')
  @Roles('super_admin', 'principal')
  @ApiOperation({ summary: '归档账本' })
  @ApiParam({ name: 'bookId', description: '账本ID' })
  @ApiResponse({ status: 200, description: '归档成功' })
  async archive(
    @Param('bookId') bookId: string,
    @CurrentUser() user: any
  ) {
    await this.ledgerBookService.archive(Number(bookId), user.orgId);
    return { archived: true };
  }
}