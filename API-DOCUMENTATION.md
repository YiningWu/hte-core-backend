# EduHub 微服务 API 文档

## 概述

EduHub 是一个基于微服务架构的教育管理系统，包含用户服务、校园服务和薪资服务三个核心微服务。

## 服务端口

- **用户服务** (User Service): http://localhost:3001
- **校园服务** (Campus Service): http://localhost:3002  
- **薪资服务** (Payroll Service): http://localhost:3003

注：**存储服务** (Storage Service) 集成在共享库中，通过各个微服务的 `/core/storage` 路径提供服务。

## Swagger 文档地址

- 用户服务: http://localhost:3001/api/docs
- 校园服务: http://localhost:3002/api/docs
- 薪资服务: http://localhost:3003/api/docs

注：存储服务API文档可在任一服务的Swagger文档中查看 `/core/storage` 路径下的接口。

## 通用请求头

所有API都需要以下请求头：

| Header | 类型 | 必需 | 描述 | 示例 |
|--------|------|------|------|------|
| Authorization | string | 是 | Bearer token | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| X-Org-Id | string | 是 | 组织ID | `1` |
| X-Request-Id | string | 否 | 请求ID，用于幂等性 | `req-123` |
| Content-Type | string | 是(POST/PATCH) | 内容类型 | `application/json` |

## 通用响应格式

所有API响应遵循统一格式：

**成功响应：**
```json
{
  "success": true,
  "message": "操作成功",
  "data": {
    // 实际响应数据
  }
}
```

**失败响应：**
```json
{
  "success": false, 
  "message": "错误信息描述",
  "data": null
}
```

## 认证服务 API (Authentication Service)

### 基础路径: `/core/auth`

#### 1. 用户登录

**POST** `/core/auth/login`

用户登录接口，验证用户凭据并返回访问令牌。**重要：登录成功后会在响应中返回用户的 `org_id`。**

**Headers:**
- `Content-Type: application/json` (必需)

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400,
    "user": {
      "user_id": 1,
      "org_id": 1,
      "username": "admin",
      "email": "admin@example.com", 
      "roles": ["admin", "hr"]
    }
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "success": false,
  "message": "邮箱或密码错误",
  "data": null
}
```

**测试账户:**
- 超级管理员: `superadmin@system.com` / `superadmin123` (org_id: 0)
- 管理员: `admin@example.com` / `password123` (org_id: 1)
- 教师: `teacher@example.com` / `teacher123` (org_id: 1)

#### 2. 刷新访问令牌

**POST** `/core/auth/refresh`

使用刷新令牌获取新的访问令牌。

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "令牌刷新成功",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 86400
  }
}
```

#### 3. 用户登出

**POST** `/core/auth/logout`

登出用户并将访问令牌加入黑名单。

**Headers:**
- `Authorization: Bearer <token>` (可选，也可以在请求体中提供)

**Request Body (可选):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "登出成功",
  "data": null
}
```

## 用户服务 API (User Service)

### 基础路径: `/core/users`

#### 1. 创建用户 

**POST** `/core/users`

创建新用户账户，包含完整的用户信息和雇佣详情。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)
- `X-Actor-User-Id: <user_id>` (必需，用于审计)
- `X-Request-Id: <request_id>` (可选，幂等性)

**Request Body:**
```json
{
  "org_id": 1,
  "campus_id": 1,
  "username": "teacher001",
  "employment_status": "ACTIVE",
  "hire_date": "2024-01-01",
  "email": "teacher@example.com",
  "phone": "+86 138-0000-1234",
  "id_card_no": "110101199001011234",
  "education": "BACHELOR",
  "hukou_address": "北京市朝阳区",
  "current_address": "上海市浦东新区",
  "gender": "MALE",
  "role": "Teacher",
  "age": 28
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "用户创建成功",
  "data": {
    "user_id": 123,
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

**Response (409 Conflict):**
```json
{
  "success": false,
  "message": "邮箱已存在",
  "data": null
}
```

#### 2. 获取用户详情

**GET** `/core/users/{id}`

根据用户ID获取用户详细信息，敏感信息会被脱敏处理。

**Path Parameters:**
- `id` (number, 必需): 用户ID

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "用户信息获取成功",
  "data": {
    "user_id": 123,
    "org_id": 1,
    "campus_id": 1,
    "username": "teacher001",
    "employment_status": "ACTIVE",
    "hire_date": "2024-01-01",
    "email": "teacher@example.com",
    "phone": "+86 138-****-1234",
    "id_card_no": "110101****1234",
    "gender": "MALE",
    "role": "Teacher",
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 3. 获取用户列表

**GET** `/core/users`

获取分页的用户列表，支持多种过滤和排序选项。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Query Parameters:**
| 参数 | 类型 | 必需 | 描述 | 示例 |
|------|------|------|------|------|
| page | number | 否 | 页码(从1开始) | 1 |
| limit | number | 否 | 每页条数(最大100) | 20 |
| search | string | 否 | 搜索关键词(用户名/邮箱/手机号) | teacher |
| employment_status | string | 否 | 雇佣状态 | ACTIVE, INACTIVE, TERMINATED |
| campus_id | number | 否 | 校园ID | 1 |
| role | string | 否 | 角色筛选 | Teacher |
| sort_by | string | 否 | 排序字段 | created_at |
| sort_order | string | 否 | 排序方向 | asc, desc |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "用户列表获取成功",
  "data": {
    "items": [
      {
        "user_id": 123,
        "username": "teacher001",
        "email": "teacher@example.com",
        "employment_status": "ACTIVE",
        "role": "Teacher",
        "created_at": "2024-01-01T12:00:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### 4. 更新用户信息

**PATCH** `/core/users/{id}`

更新用户信息，只更新提供的字段。

**Path Parameters:**
- `id` (number, 必需): 用户ID

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)
- `X-Actor-User-Id: <user_id>` (必需，用于审计)
- `X-Request-Id: <request_id>` (可选，幂等性)

**Request Body (部分更新):**
```json
{
  "email": "new.teacher@example.com",
  "role": "Senior Teacher"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "用户更新成功",
  "data": {
    "updated": true,
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 5. 删除用户

**DELETE** `/core/users/{id}`

软删除用户，用户记录被标记为删除但不会物理删除。

**Path Parameters:**
- `id` (number, 必需): 用户ID

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)
- `X-Actor-User-Id: <user_id>` (必需，用于审计)
- `X-Request-Id: <request_id>` (可选，幂等性)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "用户删除成功",
  "data": {
    "deleted": true
  }
}
```

#### 6. 获取用户变更历史

**GET** `/core/users/{id}/changes`

获取用户的变更审计日志。

**Path Parameters:**
- `id` (number, 必需): 用户ID

**Query Parameters:**
| 参数 | 类型 | 必需 | 描述 | 示例 |
|------|------|------|------|------|
| from | string | 否 | 开始日期 (ISO 8601) | 2024-01-01 |
| to | string | 否 | 结束日期 (ISO 8601) | 2024-01-31 |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "变更历史获取成功",
  "data": {
    "items": [
      {
        "changed_at": "2024-01-01T12:00:00.000Z",
        "changed_by": 1,
        "action": "UPDATE",
        "diff": {
          "email": {
            "old": "old@example.com",
            "new": "new@example.com"
          },
          "role": {
            "old": "Teacher",
            "new": "Senior Teacher"
          }
        },
        "request_id": "req-123"
      }
    ]
  }
}
```

## 校园服务 API (Campus Service)

### 基础路径: `/core/campuses`

#### 1. 创建校园

**POST** `/core/campuses`

创建新的校园实体，包含位置和配置信息。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)
- `X-Request-Id: <request_id>` (可选，幂等性)

**Request Body:**
```json
{
  "org_id": 1,
  "name": "北京主校区",
  "code": "BJ001",
  "type": "DIRECT",
  "status": "PREPARATION",
  "province": "北京市",
  "city": "北京市",
  "district": "朝阳区",
  "address": "教育大街123号",
  "latitude": 39.9042,
  "longitude": 116.4074,
  "phone": "+86 10-8888-8888",
  "email": "beijing@example.com",
  "area": 5000,
  "capacity": 500,
  "trade_area_tags": ["商业区", "交通便利"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "校园创建成功",
  "data": {
    "campus_id": 1,
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 2. 获取校园详情

**GET** `/core/campuses/{id}`

获取校园的详细信息，包括位置和配置数据。

**Path Parameters:**
- `id` (number, 必需): 校园ID

**Response (200 OK):**
```json
{
  "success": true,
  "message": "校园信息获取成功",
  "data": {
    "campus_id": 1,
    "org_id": 1,
    "name": "北京主校区",
    "code": "BJ001",
    "type": "DIRECT",
    "status": "ACTIVE",
    "province": "北京市",
    "city": "北京市",
    "district": "朝阳区",
    "address": "教育大街123号",
    "latitude": 39.9042,
    "longitude": 116.4074,
    "phone": "+86 10-8888-8888",
    "email": "beijing@example.com",
    "area": 5000,
    "capacity": 500,
    "created_at": "2024-01-01T12:00:00.000Z",
    "updated_at": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 3. 获取校园列表

**GET** `/core/campuses`

获取组织下的所有校园列表。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "校园列表获取成功",
  "data": {
    "items": [
      {
        "campus_id": 1,
        "name": "北京主校区",
        "code": "BJ001",
        "type": "DIRECT",
        "status": "ACTIVE",
        "city": "北京市",
        "address": "教育大街123号",
        "capacity": 500
      }
    ]
  }
}
```

#### 4. 创建教室

**POST** `/core/campuses/{id}/classrooms`

为指定校园创建教室。

**Path Parameters:**
- `id` (number, 必需): 校园ID

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Request Body:**
```json
{
  "name": "101教室",
  "code": "R101",
  "floor": 1,
  "capacity": 30,
  "equipment": ["投影仪", "白板", "空调"]
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "教室创建成功",
  "data": {
    "classroom_id": 1
  }
}
```

## 存储服务 API (Storage Service)

### 基础路径: `/core/storage`

#### 1. 文件上传

**POST** `/core/storage/upload`

上传文件到存储系统，支持公共和私有存储。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `Content-Type: multipart/form-data` (必需)

**Request Body (multipart/form-data):**
```
file: [文件数据]
folder: "documents"
isPublic: false
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "文件上传成功",
  "data": {
    "key": "private/org-1/documents/filename.pdf",
    "url": "https://storage.example.com/...",
    "size": 1024576,
    "contentType": "application/pdf"
  }
}
```

#### 2. 生成预签名上传URL

**POST** `/core/storage/presigned-upload-url`

生成预签名URL，用于客户端直接上传到存储系统。

**Headers:**
- `Authorization: Bearer <token>` (必需)

**Request Body:**
```json
{
  "fileName": "document.pdf",
  "contentType": "application/pdf",
  "folder": "documents"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "预签名上传URL生成成功",
  "data": {
    "uploadUrl": "https://storage.example.com/presigned-url",
    "key": "private/org-1/documents/document.pdf",
    "expiresIn": 3600
  }
}
```

#### 3. 文件下载

**GET** `/core/storage/download/{key}`

下载指定的文件。

**Path Parameters:**
- `key` (string, 必需): 文件存储键，支持路径 (例如: `folder/subfolder/file.pdf`)

**Headers:**
- `Authorization: Bearer <token>` (必需)

**Response (200 OK):**
```
Binary file data with appropriate headers:
Content-Type: application/pdf
Content-Length: 1024576
Content-Disposition: attachment; filename="file.pdf"
```

#### 4. 生成预签名下载URL

**GET** `/core/storage/presigned-download-url/{key}`

生成预签名下载URL，用于临时访问文件。

**Path Parameters:**
- `key` (string, 必需): 文件存储键

**Query Parameters:**
| 参数 | 类型 | 必需 | 描述 | 示例 |
|------|------|------|------|------|
| expiresIn | string | 否 | URL过期时间(秒) | 3600 |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "预签名下载URL生成成功",
  "data": {
    "url": "https://storage.example.com/presigned-download-url"
  }
}
```

#### 5. 删除文件

**DELETE** `/core/storage/file/{key}`

删除指定的文件(需要管理员权限)。

**Path Parameters:**
- `key` (string, 必需): 文件存储键

**Headers:**
- `Authorization: Bearer <token>` (必需)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "文件删除成功",
  "data": null
}
```

#### 6. 列出文件

**GET** `/core/storage/list/{folder}`

列出指定文件夹中的文件。

**Path Parameters:**
- `folder` (string, 必需): 文件夹路径

**Query Parameters:**
| 参数 | 类型 | 必需 | 描述 | 示例 |
|------|------|------|------|------|
| maxKeys | string | 否 | 最大返回文件数 | 100 |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "文件列表获取成功",
  "data": {
    "files": [
      {
        "key": "private/org-1/documents/file1.pdf",
        "size": 1024576,
        "lastModified": "2024-01-01T12:00:00.000Z",
        "etag": "\"abc123\""
      }
    ]
  }
}
```

#### 7. 获取文件元数据

**GET** `/core/storage/metadata/{key}`

获取文件的元数据信息。

**Path Parameters:**
- `key` (string, 必需): 文件存储键

**Response (200 OK):**
```json
{
  "success": true,
  "message": "文件元数据获取成功",
  "data": {
    "contentType": "application/pdf",
    "contentLength": 1024576,
    "lastModified": "2024-01-01T12:00:00.000Z",
    "etag": "\"abc123\"",
    "metadata": {
      "uploadedBy": "user123",
      "originalName": "document.pdf"
    }
  }
}
```

#### 8. 获取存储统计

**GET** `/core/storage/stats`

获取组织的存储使用统计(需要管理员权限)。

**Headers:**
- `Authorization: Bearer <token>` (必需)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "存储统计获取成功",
  "data": {
    "fileCount": 1250,
    "totalSize": 2147483648,
    "totalSizeFormatted": "2.00 GB"
  }
}
```

#### 9. 复制文件

**POST** `/core/storage/copy`

复制文件到新位置(需要管理员权限)。

**Headers:**
- `Authorization: Bearer <token>` (必需)

**Request Body:**
```json
{
  "sourceKey": "private/org-1/documents/source.pdf",
  "destinationKey": "private/org-1/backup/source.pdf"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "文件复制成功",
  "data": {
    "destinationKey": "private/org-1/backup/source.pdf"
  }
}
```

## 薪资服务 API (Payroll Service)

### 基础路径: `/core/payroll`

#### 1. 创建薪资标准

**POST** `/core/payroll/compensations`

为用户创建新的薪资标准，自动关闭之前的薪资区间。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Request Body:**
```json
{
  "org_id": 1,
  "user_id": 123,
  "base_salary": 8000.00,
  "perf_salary": 2000.00,
  "valid_from": "2024-01-01",
  "reason": "年度调薪",
  "operator_id": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "薪资标准创建成功",
  "data": {
    "comp_id": 456,
    "created_at": "2024-01-01T12:00:00.000Z"
  }
}
```

#### 2. 获取有效薪资标准

**GET** `/core/payroll/compensations/effective`

获取指定日期用户的有效薪资标准。

**Query Parameters:**
| 参数 | 类型 | 必需 | 描述 | 示例 |
|------|------|------|------|------|
| user_id | string | 是 | 用户ID | 123 |
| date | string | 是 | 查询日期 (YYYY-MM-DD) | 2024-01-15 |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "有效薪资标准获取成功",
  "data": {
    "user_id": 123,
    "date": "2024-01-15",
    "base_salary": 8000.00,
    "perf_salary": 2000.00,
    "source_comp_id": 456
  }
}
```

#### 3. 薪资计算预览

**GET** `/core/payroll/runs/preview`

预览用户的月度薪资计算，不生成实际的薪资单。

**Query Parameters:**
| 参数 | 类型 | 必需 | 描述 | 示例 |
|------|------|------|------|------|
| user_id | string | 是 | 用户ID | 123 |
| month | string | 是 | 计算月份 (YYYY-MM) | 2024-01 |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "薪资计算预览获取成功",
  "data": {
    "user_id": 123,
    "month": "2024-01",
    "base_salary": 8000.00,
    "perf_salary": 2000.00,
    "gross_salary": 10000.00,
    "tax_deduction": 1000.00,
    "social_security": 800.00,
    "net_salary": 8200.00
  }
}
```

#### 4. 生成薪资单

**POST** `/core/payroll/runs/generate`

为单个用户生成薪资单。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Request Body:**
```json
{
  "user_id": 123,
  "month": "2024-01",
  "org_id": 1
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "薪资单生成成功",
  "data": {
    "run_id": 789,
    "status": "GENERATED"
  }
}
```

#### 5. 批量生成薪资单

**POST** `/core/payroll/runs/generate-batch`

批量生成多个用户的薪资单。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Request Body:**
```json
{
  "user_ids": [123, 124, 125],
  "month": "2024-01",
  "org_id": 1
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "批量薪资单生成任务提交成功",
  "data": {
    "batch_id": "batch-001",
    "total_count": 3,
    "status": "SUBMITTED"
  }
}
```

#### 6. 更新薪资单状态

**PATCH** `/core/payroll/runs/{id}`

更新薪资单状态(确认或支付)。

**Path Parameters:**
- `id` (number, 必需): 薪资单ID

**Request Body:**
```json
{
  "action": "confirm"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "薪资单状态更新成功",
  "data": {
    "run_id": 789,
    "status": "CONFIRMED"
  }
}
```

#### 7. 获取薪资单列表

**GET** `/core/payroll/runs`

获取薪资单列表，支持按用户和月份筛选。

**Headers:**
- `Authorization: Bearer <token>` (必需)
- `X-Org-Id: <org_id>` (必需)

**Query Parameters:**
| 参数 | 类型 | 必需 | 描述 | 示例 |
|------|------|------|------|------|
| user_id | string | 否 | 用户ID | 123 |
| month | string | 否 | 月份 (YYYY-MM) | 2024-01 |

**Response (200 OK):**
```json
{
  "success": true,
  "message": "薪资单列表获取成功",
  "data": {
    "items": [
      {
        "run_id": 789,
        "user_id": 123,
        "month": "2024-01",
        "status": "CONFIRMED",
        "gross_salary": 10000.00,
        "net_salary": 8200.00,
        "generated_at": "2024-01-01T12:00:00.000Z"
      }
    ]
  }
}
```

## 错误响应格式

所有API的错误响应都遵循以下格式：

```json
{
  "statusCode": 400,
  "message": "详细错误信息",
  "error": "错误类型",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "path": "/core/users"
}
```

## 常见错误代码和响应格式

所有错误响应都使用统一格式：`{ "success": false, "message": "错误描述", "data": null }`

| 状态码 | 错误类型 | 描述 | 示例消息 |
|--------|----------|------|----------|
| 400 | Bad Request | 请求参数错误或格式不正确 | "请求参数格式错误" |
| 401 | Unauthorized | 未认证或token无效 | "未授权访问" |
| 403 | Forbidden | 权限不足 | "权限不足" |
| 404 | Not Found | 资源不存在 | "用户不存在" |
| 409 | Conflict | 资源冲突(如邮箱重复) | "邮箱已存在" |
| 422 | Unprocessable Entity | 请求数据验证失败 | "数据验证失败" |
| 500 | Internal Server Error | 服务器内部错误 | "服务器内部错误" |

## 环境配置

开发环境下的默认配置:

```bash
# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USERNAME=root
DB_PASSWORD=rootpassword

# 加密配置
ENCRYPTION_KEY=7b9912f04477299298ca7af2d6518026
JWT_SECRET=your-jwt-secret-change-this-in-production-very-long-key-123456789

# 服务端口
USER_SERVICE_PORT=3001
CAMPUS_SERVICE_PORT=3002
PAYROLL_SERVICE_PORT=3003
```

## 数据类型说明

### EmploymentStatus 枚举
- `ACTIVE`: 在职
- `INACTIVE`: 休假  
- `TERMINATED`: 离职

### Education 枚举
- `HIGH_SCHOOL`: 高中
- `BACHELOR`: 本科
- `MASTER`: 硕士
- `DOCTOR`: 博士
- `OTHER`: 其他

### Gender 枚举
- `MALE`: 男性
- `FEMALE`: 女性
- `UNDISCLOSED`: 未说明

### CampusType 枚举
- `DIRECT`: 直营
- `FRANCHISE`: 加盟
- `PARTNER`: 合作

### CampusStatus 枚举
- `PREPARATION`: 筹备中
- `ACTIVE`: 运营中
- `SUSPENDED`: 暂停
- `CLOSED`: 关闭

## 开发调试

1. 启动所有服务:
```bash
npm run dev
```

2. 查看API文档:
- 用户服务: http://localhost:3001/api/docs
- 校园服务: http://localhost:3002/api/docs  
- 薪资服务: http://localhost:3003/api/docs

3. 健康检查:
- http://localhost:3001/healthz
- http://localhost:3002/healthz
- http://localhost:3003/healthz