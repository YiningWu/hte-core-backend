import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerBook } from '../../domain/entities/ledger-book.entity';
import { CreateLedgerBookDto } from '../../interfaces/dto/create-ledger-book.dto';
import { LedgerBookStatus } from '../../domain/enums/billing.enum';

@Injectable()
export class LedgerBookService {
  constructor(
    @InjectRepository(LedgerBook)
    private readonly ledgerBookRepository: Repository<LedgerBook>
  ) {}

  async create(createDto: CreateLedgerBookDto, orgId: number): Promise<LedgerBook> {
    // 检查是否存在重复的code
    if (createDto.code) {
      const existingBook = await this.ledgerBookRepository.findOne({
        where: { orgId, code: createDto.code }
      });
      if (existingBook) {
        throw new BadRequestException(`账本编码 ${createDto.code} 已存在`);
      }
    }

    const book = this.ledgerBookRepository.create({
      ...createDto,
      orgId
    });

    return await this.ledgerBookRepository.save(book);
  }

  async findById(bookId: number, orgId: number): Promise<LedgerBook> {
    const book = await this.ledgerBookRepository.findOne({
      where: { bookId, orgId }
    });

    if (!book) {
      throw new NotFoundException('账本不存在或无权限访问');
    }

    return book;
  }

  async findByOrgAndCampus(orgId: number, campusId?: number): Promise<LedgerBook[]> {
    const where: any = { orgId, status: LedgerBookStatus.ACTIVE };
    if (campusId) {
      where.campusId = campusId;
    }

    return await this.ledgerBookRepository.find({
      where,
      order: { createdAt: 'DESC' }
    });
  }

  async findAll(
    orgId: number,
    options: {
      campusId?: number;
      status?: LedgerBookStatus;
      q?: string;
      pageSize?: number;
      cursor?: string;
    }
  ): Promise<{ items: LedgerBook[]; nextCursor?: string; total: number }> {
    const { campusId, status = LedgerBookStatus.ACTIVE, q, pageSize = 20, cursor } = options;

    const queryBuilder = this.ledgerBookRepository.createQueryBuilder('book');
    
    queryBuilder.where('book.orgId = :orgId', { orgId });

    if (campusId) {
      queryBuilder.andWhere('book.campusId = :campusId', { campusId });
    }

    if (status) {
      queryBuilder.andWhere('book.status = :status', { status });
    }

    if (q) {
      queryBuilder.andWhere(
        '(book.name LIKE :q OR book.code LIKE :q)',
        { q: `%${q}%` }
      );
    }

    // 游标分页
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString();
      const cursorData = JSON.parse(decodedCursor);
      queryBuilder.andWhere('book.bookId < :cursorId', { cursorId: cursorData.bookId });
    }

    queryBuilder
      .orderBy('book.bookId', 'DESC')
      .limit(pageSize);

    const items = await queryBuilder.getMany();
    
    // 计算总数（简化版本，实际项目中可以考虑缓存）
    const totalQuery = this.ledgerBookRepository.createQueryBuilder('book');
    totalQuery.where('book.orgId = :orgId', { orgId });
    if (campusId) totalQuery.andWhere('book.campusId = :campusId', { campusId });
    if (status) totalQuery.andWhere('book.status = :status', { status });
    if (q) totalQuery.andWhere('(book.name LIKE :q OR book.code LIKE :q)', { q: `%${q}%` });
    
    const total = await totalQuery.getCount();

    let nextCursor: string | undefined;
    if (items.length === pageSize && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ bookId: lastItem.bookId })).toString('base64');
    }

    return { items, nextCursor, total };
  }

  async update(bookId: number, orgId: number, updateData: Partial<CreateLedgerBookDto>): Promise<LedgerBook> {
    const book = await this.findById(bookId, orgId);

    // 检查code冲突
    if (updateData.code && updateData.code !== book.code) {
      const existingBook = await this.ledgerBookRepository.findOne({
        where: { orgId, code: updateData.code }
      });
      if (existingBook && existingBook.bookId !== bookId) {
        throw new BadRequestException(`账本编码 ${updateData.code} 已存在`);
      }
    }

    Object.assign(book, updateData);
    return await this.ledgerBookRepository.save(book);
  }

  async archive(bookId: number, orgId: number): Promise<LedgerBook> {
    const book = await this.findById(bookId, orgId);
    book.status = LedgerBookStatus.ARCHIVED;
    return await this.ledgerBookRepository.save(book);
  }

  // 获取校区的默认账本（如果存在）
  async getDefaultBookForCampus(orgId: number, campusId: number): Promise<LedgerBook | null> {
    return await this.ledgerBookRepository.findOne({
      where: { orgId, campusId, status: LedgerBookStatus.ACTIVE },
      order: { createdAt: 'ASC' }
    });
  }
}