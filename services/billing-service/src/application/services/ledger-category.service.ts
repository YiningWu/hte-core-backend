import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerCategory } from '../../domain/entities/ledger-category.entity';
import { CreateLedgerCategoryDto } from '../../interfaces/dto/create-ledger-category.dto';
import { EntryType } from '../../domain/enums/billing.enum';

@Injectable()
export class LedgerCategoryService {
  constructor(
    @InjectRepository(LedgerCategory)
    private readonly categoryRepository: Repository<LedgerCategory>
  ) {}

  async create(createDto: CreateLedgerCategoryDto, orgId: number): Promise<LedgerCategory> {
    // 检查是否存在重复的code（同一org下同一type）
    const existingCategory = await this.categoryRepository.findOne({
      where: { orgId, type: createDto.type, code: createDto.code }
    });
    
    if (existingCategory) {
      throw new BadRequestException(`类目代码 ${createDto.code} 在 ${createDto.type} 类型下已存在`);
    }

    const category = this.categoryRepository.create({
      ...createDto,
      orgId
    });

    return await this.categoryRepository.save(category);
  }

  async findById(categoryId: number, orgId: number): Promise<LedgerCategory> {
    const category = await this.categoryRepository.findOne({
      where: { categoryId, orgId }
    });

    if (!category) {
      throw new NotFoundException('类目不存在或无权限访问');
    }

    return category;
  }

  async findByCode(code: string, type: EntryType, orgId: number): Promise<LedgerCategory | null> {
    return await this.categoryRepository.findOne({
      where: { orgId, type, code, isActive: true }
    });
  }

  async findAll(
    orgId: number,
    options: {
      type?: EntryType;
      isActive?: boolean;
      q?: string;
    }
  ): Promise<LedgerCategory[]> {
    const { type, isActive = true, q } = options;

    const queryBuilder = this.categoryRepository.createQueryBuilder('category');
    
    queryBuilder.where('category.orgId = :orgId', { orgId });

    if (type) {
      queryBuilder.andWhere('category.type = :type', { type });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('category.isActive = :isActive', { isActive });
    }

    if (q) {
      queryBuilder.andWhere(
        '(category.name LIKE :q OR category.code LIKE :q)',
        { q: `%${q}%` }
      );
    }

    queryBuilder.orderBy('category.type', 'ASC')
              .addOrderBy('category.code', 'ASC');

    return await queryBuilder.getMany();
  }

  async update(categoryId: number, orgId: number, updateData: Partial<CreateLedgerCategoryDto>): Promise<LedgerCategory> {
    const category = await this.findById(categoryId, orgId);

    // 检查code冲突
    if (updateData.code && updateData.code !== category.code) {
      const type = updateData.type || category.type;
      const existingCategory = await this.categoryRepository.findOne({
        where: { orgId, type, code: updateData.code }
      });
      if (existingCategory && existingCategory.categoryId !== categoryId) {
        throw new BadRequestException(`类目代码 ${updateData.code} 在 ${type} 类型下已存在`);
      }
    }

    Object.assign(category, updateData);
    return await this.categoryRepository.save(category);
  }

  async deactivate(categoryId: number, orgId: number): Promise<LedgerCategory> {
    const category = await this.findById(categoryId, orgId);
    category.isActive = false;
    return await this.categoryRepository.save(category);
  }

  async activate(categoryId: number, orgId: number): Promise<LedgerCategory> {
    const category = await this.findById(categoryId, orgId);
    category.isActive = true;
    return await this.categoryRepository.save(category);
  }

  // 初始化默认类目
  async initializeDefaultCategories(orgId: number): Promise<void> {
    const defaultCategories = [
      // 收入类目
      { type: EntryType.INCOME, code: 'new_signup', name: '新签', isTeacherRelated: true },
      { type: EntryType.INCOME, code: 'renewal', name: '续费', isTeacherRelated: true },
      { type: EntryType.INCOME, code: 'other_income', name: '其他收入', isTeacherRelated: false },
      
      // 支出类目
      { type: EntryType.EXPENSE, code: 'rent', name: '房租', isTeacherRelated: false },
      { type: EntryType.EXPENSE, code: 'utilities', name: '水电费', isTeacherRelated: false },
      { type: EntryType.EXPENSE, code: 'materials', name: '教材物料', isTeacherRelated: false },
      { type: EntryType.EXPENSE, code: 'marketing', name: '市场推广', isTeacherRelated: false },
      { type: EntryType.EXPENSE, code: 'other_expense', name: '其他支出', isTeacherRelated: false },
    ];

    for (const categoryData of defaultCategories) {
      const existing = await this.categoryRepository.findOne({
        where: { orgId, type: categoryData.type, code: categoryData.code }
      });

      if (!existing) {
        const category = this.categoryRepository.create({
          ...categoryData,
          orgId
        });
        await this.categoryRepository.save(category);
      }
    }
  }
}