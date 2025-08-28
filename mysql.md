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
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
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
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
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
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
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
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
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
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
);
```

## 用户服务 (User Service)

### 数据库：`user_service`

用户服务管理用户主数据及角色信息。

#### 1. 用户表 (`user`)

```sql
CREATE TABLE `user` (
  `user_id` bigint NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `org_id` bigint NOT NULL COMMENT '机构ID',
  `campus_id` bigint DEFAULT NULL COMMENT '校区ID',
  `username` varchar(50) NOT NULL UNIQUE COMMENT '用户名',
  `employment_status` enum('ACTIVE','LEAVE','SUSPEND') NOT NULL DEFAULT 'ACTIVE' COMMENT '任职状态',
  `hire_date` date NOT NULL COMMENT '入职日期',
  `email` varchar(100) NOT NULL UNIQUE COMMENT '邮箱',
  `phone` varchar(20) NOT NULL UNIQUE COMMENT '手机号',
  `id_card_no_hash` varchar(200) NOT NULL UNIQUE COMMENT '身份证号哈希',
  `id_card_no_encrypted` text COMMENT '加密身份证号',
  `id_card_file` varchar(500) DEFAULT NULL COMMENT '身份证文件',
  `education` enum('PRIMARY','MIDDLE','HIGH','VOCATIONAL','ASSOCIATE','BACHELOR','MASTER','DOCTOR','OTHER') DEFAULT 'OTHER' COMMENT '学历',
  `hukou_address` varchar(200) DEFAULT NULL COMMENT '户籍地址',
  `current_address` varchar(200) DEFAULT NULL COMMENT '现居地址',
  `gender` enum('MALE','FEMALE','OTHER','UNDISCLOSED') DEFAULT 'UNDISCLOSED' COMMENT '性别',
  `role` varchar(50) DEFAULT NULL COMMENT '主角色',
  `age` tinyint DEFAULT NULL COMMENT '年龄',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`user_id`)
);
```

#### 2. 角色表 (`role`)

```sql
CREATE TABLE `role` (
  `role_id` bigint NOT NULL AUTO_INCREMENT COMMENT '角色ID',
  `code` varchar(50) NOT NULL UNIQUE COMMENT '角色编码',
  `name` varchar(100) NOT NULL COMMENT '角色名称',
  PRIMARY KEY (`role_id`)
);
```

#### 3. 用户角色关联表 (`user_role`)

```sql
CREATE TABLE `user_role` (
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `role_id` bigint NOT NULL COMMENT '角色ID',
  PRIMARY KEY (`user_id`, `role_id`)
);
```

#### 4. 审计日志表 (`audit_log`)

```sql
CREATE TABLE `audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `org_id` bigint NOT NULL COMMENT '机构ID',
  `actor_user_id` bigint NOT NULL COMMENT '操作者ID',
  `entity_type` varchar(50) NOT NULL COMMENT '实体类型',
  `entity_id` bigint NOT NULL COMMENT '实体ID',
  `action` varchar(20) NOT NULL COMMENT '操作类型',
  `diff_json` json DEFAULT NULL COMMENT '变更内容',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `request_id` varchar(100) DEFAULT NULL COMMENT '请求ID',
  PRIMARY KEY (`id`)
);
```

## 校区服务 (Campus Service)

### 数据库：`campus_service`

校区服务维护机构、校区及教室等信息。

#### 1. 机构表 (`org`)

```sql
CREATE TABLE `org` (
  `org_id` bigint NOT NULL AUTO_INCREMENT COMMENT '机构ID',
  `name` varchar(100) NOT NULL UNIQUE COMMENT '机构名称',
  `code` varchar(50) NOT NULL UNIQUE COMMENT '机构编码',
  `remark` text DEFAULT NULL COMMENT '备注',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`org_id`)
);
```

#### 2. 税务配置表 (`tax_profile`)

```sql
CREATE TABLE `tax_profile` (
  `tax_profile_id` bigint NOT NULL AUTO_INCREMENT COMMENT '税务配置ID',
  `name` varchar(100) NOT NULL UNIQUE COMMENT '名称',
  `rate` decimal(5,4) NOT NULL COMMENT '税率',
  `is_tax_included` tinyint(1) DEFAULT 0 COMMENT '含税标记',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`tax_profile_id`)
);
```

#### 3. 校区表 (`campus`)

```sql
CREATE TABLE `campus` (
  `campus_id` bigint NOT NULL AUTO_INCREMENT COMMENT '校区ID',
  `org_id` bigint NOT NULL COMMENT '机构ID',
  `name` varchar(100) NOT NULL COMMENT '校区名称',
  `code` varchar(50) NOT NULL UNIQUE COMMENT '校区编码',
  `type` enum('DIRECT','FRANCHISE','PARTNER') NOT NULL COMMENT '校区类型',
  `status` enum('PREPARATION','TRIAL','OPEN','CLOSED','SHUTDOWN') NOT NULL COMMENT '状态',
  `province` varchar(50) DEFAULT NULL,
  `city` varchar(50) DEFAULT NULL,
  `district` varchar(50) DEFAULT NULL,
  `address` varchar(200) DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `principal_user_id` bigint DEFAULT NULL COMMENT '负责人用户ID',
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `biz_hours` json DEFAULT NULL,
  `open_date` date DEFAULT NULL,
  `close_date` date DEFAULT NULL,
  `area` decimal(10,2) DEFAULT NULL,
  `capacity` int DEFAULT NULL,
  `trade_area_tags` json DEFAULT NULL,
  `remark` text DEFAULT NULL,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`campus_id`)
);
```

#### 4. 教室表 (`classroom`)

```sql
CREATE TABLE `classroom` (
  `classroom_id` bigint NOT NULL AUTO_INCREMENT COMMENT '教室ID',
  `campus_id` bigint NOT NULL COMMENT '所属校区ID',
  `name` varchar(100) NOT NULL COMMENT '教室名称',
  `code` varchar(50) NOT NULL UNIQUE COMMENT '教室编码',
  `capacity` int DEFAULT NULL COMMENT '容量',
  `course_type_tags` json DEFAULT NULL COMMENT '课程类型标签',
  `status` enum('AVAILABLE','MAINTENANCE','DISABLED') NOT NULL COMMENT '状态',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`classroom_id`)
);
```

#### 5. 校区计费配置表 (`campus_billing_profile`)

```sql
CREATE TABLE `campus_billing_profile` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `campus_id` bigint NOT NULL COMMENT '校区ID',
  `invoice_title` varchar(200) NOT NULL COMMENT '发票抬头',
  `tax_no` varchar(50) NOT NULL COMMENT '税号',
  `bank_name` varchar(100) DEFAULT NULL COMMENT '开户行',
  `bank_account` varchar(50) DEFAULT NULL COMMENT '银行账号',
  `invoice_address` varchar(200) DEFAULT NULL COMMENT '发票地址',
  `phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `tax_profile_id` bigint NOT NULL COMMENT '税务配置ID',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
);
```

#### 6. 审计日志表 (`audit_log`)

```sql
CREATE TABLE `audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `org_id` bigint NOT NULL COMMENT '机构ID',
  `actor_user_id` bigint NOT NULL COMMENT '操作者ID',
  `entity_type` varchar(50) NOT NULL COMMENT '实体类型',
  `entity_id` bigint NOT NULL COMMENT '实体ID',
  `action` varchar(20) NOT NULL COMMENT '操作类型',
  `diff_json` json DEFAULT NULL COMMENT '变更内容',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `request_id` varchar(100) DEFAULT NULL COMMENT '请求ID',
  PRIMARY KEY (`id`)
);
```

## 薪资服务 (Payroll Service)

### 数据库：`payroll_service`

薪资服务用于维护薪资区间和发薪记录。

#### 1. 薪资设置表 (`user_compensation`)

```sql
CREATE TABLE `user_compensation` (
  `comp_id` bigint NOT NULL AUTO_INCREMENT COMMENT '薪资记录ID',
  `org_id` bigint NOT NULL COMMENT '机构ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `base_salary` decimal(12,2) NOT NULL COMMENT '基础工资',
  `perf_salary` decimal(12,2) NOT NULL COMMENT '绩效工资',
  `valid_from` date NOT NULL COMMENT '生效开始',
  `valid_to` date DEFAULT NULL COMMENT '生效结束(不含)',
  `reason` varchar(200) DEFAULT NULL COMMENT '调整原因',
  `created_by` bigint NOT NULL COMMENT '创建人',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`comp_id`)
);
```

#### 2. 薪资发放表 (`payroll_run`)

```sql
CREATE TABLE `payroll_run` (
  `run_id` bigint NOT NULL AUTO_INCREMENT COMMENT '发薪ID',
  `org_id` bigint NOT NULL COMMENT '机构ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `payroll_month` date NOT NULL COMMENT '薪资月份',
  `period_start` date NOT NULL COMMENT '开始日期',
  `period_end` date NOT NULL COMMENT '结束日期',
  `days_in_month` int NOT NULL COMMENT '月天数',
  `days_covered` int NOT NULL COMMENT '覆盖天数',
  `base_amount` decimal(12,2) NOT NULL COMMENT '基础金额',
  `perf_amount` decimal(12,2) NOT NULL COMMENT '绩效金额',
  `allowances` decimal(12,2) DEFAULT 0 COMMENT '津贴',
  `deductions` decimal(12,2) DEFAULT 0 COMMENT '扣款',
  `gross_amount` decimal(12,2) NOT NULL COMMENT '应发',
  `tax_amount` decimal(12,2) DEFAULT 0 COMMENT '税额',
  `net_amount` decimal(12,2) NOT NULL COMMENT '实发',
  `status` enum('DRAFT','CONFIRMED','PAID') NOT NULL DEFAULT 'DRAFT' COMMENT '状态',
  `snapshot_json` json DEFAULT NULL COMMENT '快照',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`run_id`)
);
```

#### 3. 审计日志表 (`audit_log`)

```sql
CREATE TABLE `audit_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '日志ID',
  `org_id` bigint NOT NULL COMMENT '机构ID',
  `actor_user_id` bigint NOT NULL COMMENT '操作者ID',
  `entity_type` varchar(50) NOT NULL COMMENT '实体类型',
  `entity_id` bigint NOT NULL COMMENT '实体ID',
  `action` varchar(20) NOT NULL COMMENT '操作类型',
  `diff_json` json DEFAULT NULL COMMENT '变更内容',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `request_id` varchar(100) DEFAULT NULL COMMENT '请求ID',
  PRIMARY KEY (`id`)
);
```

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

*最后更新时间: 2025-08-28*
