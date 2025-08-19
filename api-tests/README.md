# EduHub 环境与数据库工具

这个目录包含了 EduHub 微服务系统的环境配置、数据库验证和测试数据初始化工具。

## 📁 目录结构

```
api-tests/
├── test-config.json           # 测试配置文件
├── health-check.sh           # 服务健康检查脚本
├── verify-database.sh        # 数据库表结构验证脚本
├── verify-database-schema.sh # 数据库字段详细验证脚本
├── init-test-data.sh         # 测试数据初始化脚本
└── README.md                 # 本文档
```

## 🚀 快速开始

### 前置条件

1. **确保 EduHub 服务正在运行**:
   ```bash
   # 在项目根目录
   npm run dev
   ```

2. **安装必需的工具**:
   ```bash
   # Ubuntu/Debian
   sudo apt-get install curl jq mysql-client
   
   # macOS
   brew install curl jq mysql-client
   
   # Windows (WSL)
   sudo apt-get install curl jq mysql-client
   ```

### 使用工具

#### 数据库验证与初始化

```bash
cd api-tests

# 验证数据库表结构
./verify-database.sh

# 详细验证字段和约束
./verify-database-schema.sh

# 初始化测试数据
./init-test-data.sh
```

#### 服务状态检查

```bash
# 检查服务是否启动
./health-check.sh

# 或手动检查各服务
curl http://localhost:3001/healthz  # 用户服务
curl http://localhost:3002/healthz  # 校区服务
curl http://localhost:3003/healthz  # 薪资服务
```

## 🔧 工具功能说明

### 数据库验证工具

#### `verify-database.sh`
- 检查数据库连接状态
- 验证各服务数据库是否存在
- 检查必需的表是否创建
- 验证基础数据是否存在

#### `verify-database-schema.sh`
- 详细检查表结构和字段定义
- 验证索引和约束
- 检查外键关系
- 确认数据类型和字段属性

### 数据初始化工具

#### `init-test-data.sh`
- 初始化系统角色数据
- 创建测试管理员账户
- 设置基础组织和校区数据
- 配置税务和计费信息

### 健康检查工具

#### `health-check.sh`
- 检查所有服务的运行状态
- 验证服务端点可访问性
- 提供服务就绪状态报告

## ⚙️ 配置说明

### test-config.json

```json
{
  "baseUrls": {
    "userService": "http://localhost:3001",
    "campusService": "http://localhost:3002", 
    "payrollService": "http://localhost:3003"
  },
  "testData": {
    "admin": {
      "email": "admin@example.com",
      "password": "password123"
    },
    "testOrg": {
      "id": 1,
      "name": "测试机构"
    }
  }
}
```

## 🔍 工具输出说明

### 成功标识
- ✅ 表示检查通过或操作成功
- 显示详细的状态信息
- 提供数据验证结果

### 失败标识  
- ❌ 表示检查失败或操作失败
- ⚠️ 表示警告或需要注意的情况
- 显示错误详情和建议解决方案

### 示例输出

```bash
🚀 开始初始化测试数据
======================================
✅ 数据库连接成功

1. 初始化角色数据...
✅ 角色数据初始化成功

2. 初始化测试用户...
✅ 测试用户初始化成功
```

## 🐛 常见问题排查

### 1. 服务无响应

**问题**: Connection refused 错误
**解决**: 
```bash
# 检查服务状态
docker-compose ps
./health-check.sh

# 重启服务
npm run dev
```

### 2. 数据库相关错误

**问题1**: 数据库连接错误
**解决**: 
```bash
# 检查数据库连接
mysql -h 127.0.0.1 -P 3307 -u root -prootpassword -e "SHOW DATABASES;"

# 重启数据库
docker-compose restart mysql
```

**问题2**: Table doesn't exist 错误
**解决**:
```bash
# 验证表是否存在
./verify-database.sh

# 详细检查表结构
./verify-database-schema.sh

# 如果表缺失，确保服务以 development 模式运行
NODE_ENV=development npm run dev
```

**问题3**: 测试数据缺失
**解决**:
```bash
# 重新初始化测试数据
./init-test-data.sh

# 验证测试用户是否存在
mysql -h 127.0.0.1 -P 3307 -u root -prootpassword -e "
USE user_service; 
SELECT username, email FROM user WHERE email='admin@example.com';"
```

**问题4**: 索引冲突错误 (Duplicate key name)
**解决**:
```bash
# 删除冲突的数据库重新创建
mysql -h 127.0.0.1 -P 3307 -u root -prootpassword -e "
DROP DATABASE payroll_service; 
CREATE DATABASE payroll_service;"

# 重启服务让 TypeORM 重新同步
npm run dev
```

### 3. 权限错误

**问题**: 脚本无执行权限
**解决**:
```bash
chmod +x api-tests/*.sh
```

## 📚 相关文档

- [EduHub 项目文档](../README.md)
- [开发指南](../DEVELOPMENT.md)
- [部署指南](../DEPLOYMENT.md)

---

## 🤝 贡献

如果你发现工具脚本有问题或需要改进，欢迎提交 Issue 或 Pull Request。

**Happy Developing! 🎉**