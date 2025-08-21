-- ====================================
-- 账单服务 (Billing Service) 数据库表结构
-- Database: billing_service
-- Generated: 2025-08-21
-- ====================================

USE billing_service;

-- 设置字符集和排序规则
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ====================================
-- 1. 账本表 (ledger_book)
-- ====================================
CREATE TABLE `ledger_book` (
  `bookId` bigint NOT NULL AUTO_INCREMENT COMMENT '账本ID',
  `orgId` bigint NOT NULL COMMENT '机构ID',
  `campusId` bigint NOT NULL COMMENT '校区ID',
  `name` varchar(255) NOT NULL COMMENT '账本名称',
  `code` varchar(100) DEFAULT NULL COMMENT '账本编码',
  `currency` char(3) DEFAULT 'CNY' COMMENT '货币类型',
  `status` enum('active','archived') DEFAULT 'active' COMMENT '账本状态',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updatedAt` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`bookId`),
  KEY `IDX_ledger_book_orgId` (`orgId`),
  KEY `IDX_ledger_book_campusId` (`campusId`),
  KEY `IDX_ledger_book_code` (`code`),
  KEY `IDX_ledger_book_org_campus_status` (`orgId`,`campusId`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账本表';

-- ====================================
-- 2. 账单类目表 (ledger_category)
-- ====================================
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
  UNIQUE KEY `UQ_category_code_per_org_type` (`orgId`,`type`,`code`),
  KEY `IDX_ledger_category_orgId` (`orgId`),
  KEY `IDX_ledger_category_org_type_active` (`orgId`,`type`,`isActive`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账单类目表';

-- ====================================
-- 3. 账单条目表 (ledger_entry)
-- ====================================
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
  PRIMARY KEY (`entryId`),
  KEY `IDX_ledger_entry_bookId` (`bookId`),
  KEY `IDX_ledger_entry_orgId` (`orgId`),
  KEY `IDX_ledger_entry_campusId` (`campusId`),
  KEY `IDX_ledger_entry_occurredAt` (`occurredAt`),
  KEY `IDX_ledger_entry_requestId` (`requestId`),
  KEY `IDX_ledger_entry_org_campus_occurred` (`orgId`,`campusId`,`occurredAt`),
  KEY `IDX_ledger_entry_org_campus_type_category` (`orgId`,`campusId`,`type`,`categoryCode`,`occurredAt`),
  KEY `IDX_ledger_entry_org_reporter` (`orgId`,`reporterName`,`occurredAt`),
  KEY `IDX_ledger_entry_org_recorder` (`orgId`,`recorderName`,`occurredAt`),
  CONSTRAINT `FK_ledger_entry_book` FOREIGN KEY (`bookId`) REFERENCES `ledger_book` (`bookId`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账单条目表';

-- ====================================
-- 4. 老师分成表 (ledger_entry_teacher_share)
-- ====================================
CREATE TABLE `ledger_entry_teacher_share` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '分成记录ID',
  `entryId` char(26) NOT NULL COMMENT '关联的账单条目ID',
  `teacherUserId` bigint DEFAULT NULL COMMENT '老师用户ID',
  `teacherName` varchar(255) NOT NULL COMMENT '老师姓名',
  `ratio` decimal(5,4) NOT NULL COMMENT '分成比例 [0,1]',
  `money` decimal(12,2) DEFAULT '0.00' COMMENT '分成金额',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `IDX_teacher_share_entryId` (`entryId`),
  KEY `IDX_teacher_share_teacherName` (`teacherName`),
  KEY `IDX_teacher_share_teacher_entry` (`teacherUserId`,`entryId`),
  CONSTRAINT `FK_teacher_share_entry` FOREIGN KEY (`entryId`) REFERENCES `ledger_entry` (`entryId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='老师分成记录表';

-- ====================================
-- 5. 账单附件表 (ledger_attachment)
-- ====================================
CREATE TABLE `ledger_attachment` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '附件ID',
  `entryId` char(26) NOT NULL COMMENT '关联的账单条目ID',
  `objectKey` varchar(512) NOT NULL COMMENT '对象存储Key或URL',
  `mimeType` varchar(100) DEFAULT NULL COMMENT '文件MIME类型',
  `originalName` varchar(255) DEFAULT NULL COMMENT '原始文件名',
  `size` bigint DEFAULT NULL COMMENT '文件大小(字节)',
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `IDX_ledger_attachment_entryId` (`entryId`),
  CONSTRAINT `FK_ledger_attachment_entry` FOREIGN KEY (`entryId`) REFERENCES `ledger_entry` (`entryId`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账单附件表';

-- ====================================
-- 6. 审计日志表 (ledger_audit)
-- ====================================
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
  PRIMARY KEY (`id`),
  KEY `IDX_ledger_audit_orgId` (`orgId`),
  KEY `IDX_ledger_audit_campusId` (`campusId`),
  KEY `IDX_ledger_audit_org_campus` (`orgId`,`campusId`),
  KEY `IDX_ledger_audit_entity` (`entityType`,`entityId`),
  KEY `IDX_ledger_audit_actor` (`actorUserId`),
  KEY `IDX_ledger_audit_requestId` (`requestId`),
  KEY `IDX_ledger_audit_createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='账单系统审计日志表';

-- ====================================
-- 7. 初始化默认类目数据
-- ====================================

-- 注意：默认类目数据将由应用程序在启动时自动初始化
-- 请参考 LedgerCategoryService.initializeDefaultCategories() 方法

-- ====================================
-- 8. 重置外键约束检查
-- ====================================
SET FOREIGN_KEY_CHECKS = 1;

-- ====================================
-- 脚本执行完成
-- ====================================