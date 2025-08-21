# MySQL 数据库结构文档

本文档描述了HTE核心后端系统的MySQL数据库结构，包括所有微服务的数据库表设计。

## 📋 目录

- [数据库概览](#数据库概览)
- [账单服务 (Billing Service)](#账单服务-billing-service)
- [用户服务 (User Service)](#用户服务-user-service)
- [校区服务 (Campus Service)](#校区服务-campus-service)
- [薪资服务 (Payroll Service)](#薪资服务-payroll-service)
- [数据库初始化](#数据库初始化)
- [索引策略](#索引策略)
- [数据约束](#数据约束)

## 数据库概览

系统采用微服务架构，每个服务使用独立的数据库：

| 数据库名 | 服务名 | 主要功能 |
|---------|--------|----------|
| `user_service` | 用户服务 | 用户管理、角色权限 |
| `campus_service` | 校区服务 | 校区管理、教室资源 |
| `payroll_service` | 薪资服务 | 薪资计算、工资发放 |
| `billing_service` | 账单服务 | 财务账单、老师分成 |

## 账单服务 (Billing Service)

### 数据库：`billing_service`

账单服务负责处理机构的财务收支管理、老师分成计算和报表统计。

#### 1. 账本表 (`ledger_book`)

管理不同校区的独立账本。

```sql
CREATE TABLE `ledger_book` (
  `bookId` bigint NOT NULL AUTO_INCREMENT COMMENT '账本ID',
  `orgId` bigint NOT NULL COMMENT '机构ID',
  `campusId` bigint NOT NULL COMMENT '校区ID',
  `name` varchar(255) NOT NULL COMMENT '账本名称',
  `code` varchar(100) DEFAULT NULL COMMENT '账本编码',
  `currency` char(3) DEFAULT 'CNY' COMMENT '货币类型',
  `status` enum('active','archived') DEFAULT 'active' COMMENT '账本状态',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`bookId`)
);
```

**字段说明:**
- `bookId`: 账本主键ID
- `orgId`: 机构ID，支持多租户
- `campusId`: 校区ID，每个校区独立账本
- `name`: 账本显示名称
- `code`: 账本业务编码（可选）
- `currency`: 货币类型（CNY/USD/TWD）
- `status`: 账本状态（活跃/归档）

#### 2. 账单类目表 (`ledger_category`)

定义收入和支出的分类类目。

```sql
CREATE TABLE `ledger_category` (
  `categoryId` bigint NOT NULL AUTO_INCREMENT COMMENT '类目ID',
  `orgId` bigint NOT NULL COMMENT '机构ID',
  `type` enum('income','expense') NOT NULL COMMENT '类型：收入/支出',
  `code` varchar(100) NOT NULL COMMENT '类目编码',
  `name` varchar(255) NOT NULL COMMENT '类目名称',
  `isTeacherRelated` tinyint(1) DEFAULT '0' COMMENT '是否与老师分成相关',
  `isActive` tinyint(1) DEFAULT '1' COMMENT '是否启用',
  PRIMARY KEY (`categoryId`),
  UNIQUE KEY `UQ_category_code_per_org_type` (`orgId`,`type`,`code`)
);
```

**字段说明:**
- `type`: 类目类型（income收入/expense支出）
- `code`: 类目编码，机构内唯一
- `isTeacherRelated`: 标记是否需要计算老师分成
- `isActive`: 软删除标记

#### 3. 账单条目表 (`ledger_entry`)

核心的账单记录表，记录所有收支明细。

```sql
CREATE TABLE `ledger_entry` (
  `entryId` char(26) NOT NULL COMMENT '条目ID (ULID格式)',
  `bookId` bigint NOT NULL COMMENT '所属账本ID',
  `orgId` bigint NOT NULL COMMENT '机构ID',
  `campusId` bigint NOT NULL COMMENT '校区ID',
  `type` enum('income','expense') NOT NULL COMMENT '类型：收入/支出',
  `categoryCode` varchar(100) NOT NULL COMMENT '类目编码',
  `categoryName` varchar(255) NOT NULL COMMENT '类目名称',
  `amount` decimal(12,2) NOT NULL COMMENT '金额，正数存储',
  `occurredAt` datetime NOT NULL COMMENT '业务发生时间',
  `originalText` text COMMENT '原始文本记录',
  `reporterUserId` bigint DEFAULT NULL COMMENT '报告人用户ID',
  `reporterName` varchar(255) NOT NULL COMMENT '报告人姓名',
  `recorderUserId` bigint DEFAULT NULL COMMENT '记账人用户ID',
  `recorderName` varchar(255) NOT NULL COMMENT '记账人姓名',
  `status` enum('normal','voided','draft') DEFAULT 'normal' COMMENT '条目状态',
  `attachmentsCount` int DEFAULT '0' COMMENT '附件数量冗余字段',
  `createdBy` bigint NOT NULL COMMENT '创建操作人ID',
  `requestId` varchar(255) DEFAULT NULL COMMENT '幂等请求ID',
  PRIMARY KEY (`entryId`)
);
```

**特性说明:**
- **ULID主键**: 使用ULID格式保证分布式环境下的唯一性
- **幂等性**: 通过`requestId`支持接口幂等性
- **审计追踪**: 记录报告人、记账人和操作人信息
- **软删除**: 通过`status`字段标记作废，不物理删除
- **冗余设计**: `categoryName`冗余存储，避免关联查询

#### 4. 老师分成表 (`ledger_entry_teacher_share`)

记录老师分成的详细信息。

```sql
CREATE TABLE `ledger_entry_teacher_share` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '分成记录ID',
  `entryId` char(26) NOT NULL COMMENT '关联的账单条目ID',
  `teacherUserId` bigint DEFAULT NULL COMMENT '老师用户ID',
  `teacherName` varchar(255) NOT NULL COMMENT '老师姓名',
  `ratio` decimal(5,4) NOT NULL COMMENT '分成比例 [0,1]',
  `money` decimal(12,2) DEFAULT '0.00' COMMENT '分成金额',
  PRIMARY KEY (`id`)
);
```

**计算逻辑:**
- `ratio`: 分成比例，支持到万分之一精度
- `money`: 自动计算的分成金额（条目金额 × 分成比例）

#### 5. 账单附件表 (`ledger_attachment`)

管理账单相关的附件文件。

```sql
CREATE TABLE `ledger_attachment` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '附件ID',
  `entryId` char(26) NOT NULL COMMENT '关联的账单条目ID',
  `objectKey` varchar(512) NOT NULL COMMENT '对象存储Key或URL',
  `mimeType` varchar(100) DEFAULT NULL COMMENT '文件MIME类型',
  `originalName` varchar(255) DEFAULT NULL COMMENT '原始文件名',
  `size` bigint DEFAULT NULL COMMENT '文件大小(字节)',
  PRIMARY KEY (`id`)
);
```

#### 6. 审计日志表 (`ledger_audit`)

记录所有重要操作的审计日志。

```sql
CREATE TABLE `ledger_audit` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '审计记录ID',
  `orgId` bigint NOT NULL COMMENT '机构ID',
  `campusId` bigint NOT NULL COMMENT '校区ID',
  `entityType` enum('book','entry','category') NOT NULL COMMENT '实体类型',
  `entityId` varchar(255) NOT NULL COMMENT '被操作实体的ID',
  `action` enum('create','update','void','delete') NOT NULL COMMENT '操作类型',
  `diffJson` json DEFAULT NULL COMMENT '变更内容JSON',
  `actorUserId` bigint NOT NULL COMMENT '操作人用户ID',
  `requestId` varchar(255) DEFAULT NULL COMMENT '请求ID',
  `reason` varchar(255) DEFAULT NULL COMMENT '操作原因',
  `ipAddress` varchar(45) DEFAULT NULL COMMENT 'IP地址',
  `deviceInfo` varchar(512) DEFAULT NULL COMMENT '设备信息',
  PRIMARY KEY (`id`)
);
```

## 用户服务 (User Service)

### 数据库：`user_service`

> **注意**: 用户服务的具体表结构需要根据实际entity文件补充完善。

主要表结构：
- `user`: 用户基本信息表
- `role`: 角色定义表  
- `audit_log`: 用户服务审计日志

## 校区服务 (Campus Service)

### 数据库：`campus_service`

> **注意**: 校区服务的具体表结构需要根据实际entity文件补充完善。

主要表结构：
- `campus`: 校区信息表
- `classroom`: 教室资源表
- `org`: 机构信息表
- `tax_profile`: 税务配置表
- `campus_billing_profile`: 校区计费配置表

## 薪资服务 (Payroll Service)

### 数据库：`payroll_service`

> **注意**: 薪资服务的具体表结构需要根据实际entity文件补充完善。

主要表结构：
- `payroll_run`: 薪资发放记录表
- `user_compensation`: 用户薪资设置表

## 数据库初始化

### 1. Docker 自动初始化

数据库通过Docker容器启动时自动初始化，相关脚本位于：

```
docker/mysql/init/
├── 01-databases.sql           # 创建数据库和用户
├── 02-billing-service-schema.sql  # 账单服务表结构
```

### 2. 初始化脚本执行顺序

1. **01-databases.sql**: 创建4个微服务数据库
2. **02-billing-service-schema.sql**: 创建账单服务所有表
3. 其他服务的表结构由TypeORM自动同步创建

### 3. 默认数据初始化

- 账单类目的默认数据由应用程序启动时自动创建
- 参考：`LedgerCategoryService.initializeDefaultCategories()`

## 索引策略

### 主要索引设计原则

1. **多租户隔离**: 所有查询都包含`orgId`和`campusId`
2. **时间范围查询**: 按时间字段创建索引支持报表查询
3. **业务查询优化**: 根据API查询模式设计组合索引
4. **外键约束**: 关联表之间的外键索引

### 账单服务关键索引

```sql
-- 账单条目核心查询索引
KEY `IDX_ledger_entry_org_campus_occurred` (`orgId`,`campusId`,`occurredAt`)
KEY `IDX_ledger_entry_org_campus_type_category` (`orgId`,`campusId`,`type`,`categoryCode`,`occurredAt`)

-- 老师分成查询索引
KEY `IDX_teacher_share_teacher_entry` (`teacherUserId`,`entryId`)

-- 审计日志查询索引
KEY `IDX_ledger_audit_org_campus` (`orgId`,`campusId`)
KEY `IDX_ledger_audit_createdAt` (`createdAt`)
```

## 数据约束

### 1. 外键约束

- `ledger_entry.bookId` → `ledger_book.bookId`
- `ledger_entry_teacher_share.entryId` → `ledger_entry.entryId` (CASCADE)
- `ledger_attachment.entryId` → `ledger_entry.entryId` (CASCADE)

### 2. 唯一约束

- 类目编码在机构和类型维度唯一：`(orgId, type, code)`

### 3. 数据完整性

- 金额字段使用DECIMAL(12,2)确保精度
- 枚举字段限制可选值范围
- NOT NULL约束保证核心字段完整性

## 维护建议

### 1. 性能优化

- 定期分析慢查询日志
- 根据业务增长调整索引策略
- 考虑按时间分区存储历史数据

### 2. 数据备份

- 每日全量备份所有数据库
- 重要操作前手动备份
- 定期验证备份数据完整性

### 3. 监控指标

- 数据库连接数
- 查询响应时间
- 存储空间使用率
- 索引使用效率

---

*最后更新时间: 2025-08-21*