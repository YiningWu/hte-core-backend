# 账单服务 (Billing Service)

账单服务是EduHub微服务架构中负责财务账目管理的核心服务，支持收支记录、老师分成、分类统计等功能。

## 功能特性

### 核心功能
- **账本管理**: 支持多校区独立账本，避免数据混乱
- **类目管理**: 灵活的收支类目配置，支持自定义分类
- **账单记录**: 完整的收支明细记录，支持批量导入
- **老师分成**: 针对收入类账单的老师分成计算与记录
- **报表统计**: 多维度的财务报表与统计分析

### 技术特性
- **数据隔离**: 基于组织和校区的多租户数据隔离
- **权限控制**: 细粒度的角色权限控制
- **审计追踪**: 完整的操作审计日志
- **幂等性**: 支持请求去重，避免重复记账
- **缓存优化**: Redis缓存提升查询性能

## API接口

### 账本管理
- `POST /core/billing/books` - 创建账本
- `GET /core/billing/books` - 获取账本列表
- `GET /core/billing/books/:id` - 获取账本详情
- `PATCH /core/billing/books/:id` - 更新账本
- `DELETE /core/billing/books/:id` - 归档账本

### 类目管理
- `POST /core/billing/categories` - 创建类目
- `GET /core/billing/categories` - 获取类目列表
- `PATCH /core/billing/categories/:id` - 更新类目
- `DELETE /core/billing/categories/:id` - 停用类目
- `POST /core/billing/categories/initialize-defaults` - 初始化默认类目

### 账单管理
- `POST /core/billing/entries` - 创建账单
- `POST /core/billing/entries:batch` - 批量创建账单
- `GET /core/billing/entries` - 获取账单列表
- `GET /core/billing/entries/:id` - 获取账单详情
- `PATCH /core/billing/entries/:id` - 更新账单
- `POST /core/billing/entries/:id/void` - 作废账单

### 报表统计
- `GET /core/billing/reports/summary` - 概览报表
- `GET /core/billing/reports/teacher-shares` - 老师分成报表
- `GET /core/billing/reports/by-category` - 类目分析报表

## 数据结构

### 账本 (LedgerBook)
```typescript
{
  bookId: number;           // 账本ID
  orgId: number;           // 组织ID
  campusId: number;        // 校区ID
  name: string;            // 账本名称
  code?: string;           // 账本编码
  currency: string;        // 币种 (CNY/USD/TWD)
  status: string;          // 状态 (active/archived)
}
```

### 账单条目 (LedgerEntry)
```typescript
{
  entryId: string;         // 账单ID (ULID格式)
  type: string;            // 类型 (income/expense)
  categoryCode: string;    // 类目代码
  categoryName: string;    // 类目名称
  amount: number;          // 金额
  occurredAt: Date;        // 业务发生时间
  originalText?: string;   // 原始文本
  reporterName: string;    // 报告人
  recorderName: string;    // 记账人
  status: string;          // 状态 (normal/voided/draft)
  teacherShares?: Array<{  // 老师分成
    teacherName: string;
    ratio: number;         // 分成比例 [0,1]
    money: number;         // 分成金额
  }>;
}
```

## 权限系统

### 角色定义
- **super_admin**: 全权限，可管理所有组织和校区数据
- **principal**: 校长，可管理授权校区的账单数据
- **finance**: 财务，与校长权限相近，专注财务操作
- **manager**: 运营，部分管理权限
- **teacher**: 老师，只能查看与自己相关的账单和分成
- **auditor**: 审计，只读权限

### 数据权限
- 所有操作默认按 `X-Org-Id` 进行组织隔离
- 非超级管理员只能操作授权校区的数据
- 老师角色只能查看自己参与分成或自己报告的账单

## 开发指南

### 环境要求
- Node.js 20+
- MySQL 8.0+
- Redis 7+
- Docker & Docker Compose

### 本地开发
```bash
# 启动开发环境
npm run dev

# 构建项目
npm run build

# 运行测试
npm run test
```

### Docker部署
```bash
# 构建并启动所有服务
docker-compose up --build

# 仅启动账单服务
docker-compose up billing-service
```

## 数据迁移

### 初始化类目
```bash
# 通过API初始化默认类目
curl -X POST http://localhost/core/billing/categories/initialize-defaults \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "X-Org-Id: 1"
```

### 批量导入账单
参考API文档中的批量导入接口，支持CSV数据批量导入。

## 监控与日志

- 健康检查: `GET /core/health`
- 就绪检查: `GET /core/ready` 
- API文档: `http://localhost:3004/api/docs`
- 日志级别: 开发环境显示详细日志，生产环境仅显示错误和警告

## 生产部署注意事项

1. **环境变量**: 确保设置正确的数据库连接、Redis连接、JWT密钥等
2. **数据库索引**: 生产环境关闭自动同步，手动维护数据库索引
3. **缓存配置**: 根据实际负载调整Redis缓存TTL和容量
4. **备份策略**: 设置定期数据备份和审计日志归档
5. **监控告警**: 配置服务监控和异常告警机制

## 故障排查

### 常见问题
1. **数据库连接失败**: 检查数据库服务状态和连接参数
2. **Redis连接失败**: 检查Redis服务和网络连接
3. **权限验证失败**: 检查JWT配置和用户权限设置
4. **账单ID冲突**: 确保ID生成的唯一性，检查幂等性配置

### 日志查看
```bash
# 查看服务日志
docker logs billing-service

# 实时查看日志
docker logs -f billing-service
```