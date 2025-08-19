# EduHub 开发指南

本文档提供详细的开发环境设置和开发流程指南。如需快速开始，请查看 [README.md](README.md)。

---

## 📋 目录

- [开发环境设置](#-开发环境设置)
- [代码规范](#-代码规范)
- [测试指南](#-测试指南)
- [调试指南](#-调试指南)
- [常见问题](#-常见问题)

---

## 🛠️ 开发环境设置

### 系统要求

- **Node.js** >= 20.0.0
- **npm** >= 9.0.0
- **Docker** >= 24.0.0
- **Docker Compose** >= 2.0.0
- **Git** >= 2.30.0

### IDE 推荐配置

#### VS Code 扩展
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-eslint",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-docker",
    "ms-vscode.vscode-json"
  ]
}
```

#### VS Code 设置
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### 环境配置

#### 关键环境变量说明
```env
# JWT 密钥 - 生产环境必须使用强密钥
JWT_SECRET=your-jwt-secret-change-this-in-production-very-long-key-123456789

# 数据加密密钥 - 必须是32位字符
ENCRYPTION_KEY=7b9912f04477299298ca7af2d6518026

# 数据库配置（已优化避免端口冲突）
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USERNAME=root
DB_PASSWORD=rootpassword

# Redis 密码 (可选)
REDIS_PASSWORD=your-redis-password
```

#### 快速启动开发环境

**选项 1: 使用 npm 脚本（推荐）**
```bash
# 直接启动，包含所有必需的环境变量
npm run dev

# 如果需要使用 .env 文件中的配置
npm run dev:env
```

**选项 2: 手动设置环境变量**
```bash
# 完整的环境变量启动命令
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root DB_PASSWORD=rootpassword \
ENCRYPTION_KEY=7b9912f04477299298ca7af2d6518026 \
JWT_SECRET=your-jwt-secret-change-this-in-production-very-long-key-123456789 \
npm run dev:env
```

**注意事项:**
- `npm run dev` 已经预设了开发环境所需的所有环境变量
- 确保 Docker 中的 MySQL 和 Redis 服务正在运行
- ENCRYPTION_KEY 必须恰好 32 个字符长度

---

## 📏 代码规范

### TypeScript 规范

#### 命名约定
```typescript
// 接口使用 Pascal 命名，加 I 前缀
interface IUserService {
  createUser(userData: CreateUserDto): Promise<User>;
}

// 类使用 Pascal 命名
class UserService implements IUserService {
  // 私有属性使用下划线前缀
  private readonly _repository: Repository<User>;
  
  // 方法使用 camelCase
  async createUser(userData: CreateUserDto): Promise<User> {
    // 实现...
  }
}

// 常量使用 UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;

// 枚举使用 Pascal 命名
enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  TEACHER = 'teacher'
}
```

#### 类型定义
```typescript
// 优先使用 interface 而不是 type
interface CreateUserDto {
  email: string;
  name: string;
  role: UserRole;
}

// 使用泛型增强类型安全
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// 使用联合类型
type Environment = 'development' | 'production' | 'test';
```

### NestJS 规范

#### 模块组织
```typescript
@Module({
  imports: [
    // 先导入外部模块
    TypeOrmModule.forFeature([User, Role]),
    // 再导入内部模块
    SharedModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], // 明确导出需要共享的服务
})
export class UserModule {}
```

#### 控制器规范
```typescript
@Controller('core/users')
@ApiTags('用户管理')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: '创建用户' })
  @ApiResponse({ status: 201, description: '用户创建成功' })
  @Roles('admin', 'manager')
  async createUser(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() currentUser: User,
  ): Promise<ApiResponse<User>> {
    const user = await this.userService.createUser(createUserDto, currentUser);
    return {
      success: true,
      data: user,
      message: '用户创建成功'
    };
  }
}
```

#### 服务规范
```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
    private readonly messageBroker: MessageBrokerService,
  ) {}

  async createUser(createUserDto: CreateUserDto, creator: User): Promise<User> {
    // 1. 验证业务规则
    await this.validateUserEmail(createUserDto.email);
    
    // 2. 创建实体
    const user = this.userRepository.create({
      ...createUserDto,
      createdBy: creator.id,
    });
    
    // 3. 保存到数据库
    const savedUser = await this.userRepository.save(user);
    
    // 4. 更新缓存
    await this.cacheService.set(`user:${savedUser.id}`, savedUser, 1800);
    
    // 5. 发布事件
    await this.messageBroker.publish('user.created', {
      userId: savedUser.id,
      email: savedUser.email,
    });
    
    return savedUser;
  }

  private async validateUserEmail(email: string): Promise<void> {
    const exists = await this.userRepository.findOne({ where: { email } });
    if (exists) {
      throw new ConflictException('邮箱已被使用');
    }
  }
}
```

### 错误处理规范

```typescript
// 使用 NestJS 内置异常
throw new BadRequestException('参数验证失败');
throw new UnauthorizedException('未授权访问');
throw new ForbiddenException('权限不足');
throw new NotFoundException('用户不存在');
throw new ConflictException('数据冲突');

// 自定义异常
export class UserNotActiveException extends BadRequestException {
  constructor() {
    super('用户账户未激活');
  }
}
```

---

## 📊 数据库管理

### 数据库验证和同步

项目提供了完整的数据库验证和管理脚本：

#### 验证数据库结构
```bash
# 检查所有数据库表是否正确创建
./api-tests/verify-database.sh

# 详细检查表结构、字段类型、索引和约束
./api-tests/verify-database-schema.sh
```

#### 初始化测试数据
```bash
# 创建基础测试数据（用户、角色、组织等）
./api-tests/init-test-data.sh
```

### 数据库表结构概览

#### user_service 数据库
- **role**: 角色表 (admin, hr, teacher, manager)
- **user**: 用户表 (支持加密身份证、多角色)
- **audit_log**: 审计日志表
- **user_role**: 用户角色关联表

#### campus_service 数据库  
- **org**: 组织表
- **campus**: 校区表 (支持地理位置、营业状态)
- **classroom**: 教室表 (支持课程标签、容量管理)
- **tax_profile**: 税务配置表
- **campus_billing_profile**: 校区开票信息表
- **audit_log**: 审计日志表

#### payroll_service 数据库
- **user_compensation**: 薪资标准表 (基本工资+绩效工资)
- **payroll_run**: 工资单表 (支持快照、税费计算)
- **audit_log**: 审计日志表

### TypeORM 同步说明

开发环境下，TypeORM 配置了自动同步：
```typescript
synchronize: configService.get('NODE_ENV') === 'development'
```

如果遇到表结构问题：
1. 确保 `NODE_ENV=development`
2. 重启相关服务让 TypeORM 重新同步
3. 运行验证脚本检查结果

### 常见数据库问题解决

#### 表缺失问题
```bash
# 1. 检查数据库连接
mysql -h 127.0.0.1 -P 3307 -u root -prootpassword -e "SHOW DATABASES;"

# 2. 验证表结构
./api-tests/verify-database.sh

# 3. 如需重新创建，删除数据库后重启服务
mysql -h 127.0.0.1 -P 3307 -u root -prootpassword -e "DROP DATABASE user_service;"
```

#### 索引冲突问题
如遇到 "Duplicate key name" 错误：
1. 检查实体定义中的 `@Index` 装饰器
2. 确保没有重复的索引名称
3. 删除冲突表后重新同步

#### 测试数据问题
```bash
# 重置测试数据
./api-tests/init-test-data.sh

# 验证测试用户
mysql -h 127.0.0.1 -P 3307 -u root -prootpassword -e "
USE user_service; 
SELECT u.username, u.email, GROUP_CONCAT(r.name) as roles 
FROM user u 
LEFT JOIN user_role ur ON u.user_id = ur.user_id 
LEFT JOIN role r ON ur.role_id = r.role_id 
GROUP BY u.user_id;"
```

---

## 🧪 测试指南

### 测试结构

```
src/
├── application/
│   └── services/
│       ├── user.service.ts
│       └── user.service.spec.ts    # 服务单元测试
├── interfaces/
│   └── controllers/
│       ├── user.controller.ts
│       └── user.controller.spec.ts # 控制器单元测试
└── test/
    ├── e2e/
    │   └── user.e2e-spec.ts        # 端到端测试
    └── fixtures/
        └── user.fixture.ts         # 测试数据
```

### 单元测试示例

```typescript
// user.service.spec.ts
describe('UserService', () => {
  let service: UserService;
  let repository: Repository<User>;
  let cacheService: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<Repository<User>>(getRepositoryToken(User));
    cacheService = module.get<CacheService>(CacheService);
  });

  describe('createUser', () => {
    it('should create a user successfully', async () => {
      // Arrange
      const createUserDto = { email: 'test@example.com', name: 'Test User' };
      const creator = { id: 1 } as User;
      const savedUser = { id: 1, ...createUserDto } as User;

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue(savedUser);
      jest.spyOn(repository, 'save').mockResolvedValue(savedUser);
      jest.spyOn(cacheService, 'set').mockResolvedValue();

      // Act
      const result = await service.createUser(createUserDto, creator);

      // Assert
      expect(result).toEqual(savedUser);
      expect(repository.save).toHaveBeenCalledWith(savedUser);
      expect(cacheService.set).toHaveBeenCalledWith(
        `user:${savedUser.id}`,
        savedUser,
        1800
      );
    });

    it('should throw ConflictException if email exists', async () => {
      // Arrange
      const createUserDto = { email: 'test@example.com', name: 'Test User' };
      const creator = { id: 1 } as User;
      const existingUser = { id: 2, email: 'test@example.com' } as User;

      jest.spyOn(repository, 'findOne').mockResolvedValue(existingUser);

      // Act & Assert
      await expect(service.createUser(createUserDto, creator))
        .rejects.toThrow(ConflictException);
    });
  });
});
```

### 端到端测试示例

```typescript
// user.e2e-spec.ts
describe('UserController (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 获取测试用的 JWT token
    jwtToken = await getTestJwtToken(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('/core/users (POST)', () => {
    it('should create a user', () => {
      return request(app.getHttpServer())
        .post('/core/users')
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('X-Org-Id', '1')
        .send({
          email: 'test@example.com',
          name: 'Test User',
          role: 'teacher'
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.email).toBe('test@example.com');
        });
    });

    it('should return 400 for invalid email', () => {
      return request(app.getHttpServer())
        .post('/core/users')
        .set('Authorization', `Bearer ${jwtToken}`)
        .set('X-Org-Id', '1')
        .send({
          email: 'invalid-email',
          name: 'Test User'
        })
        .expect(400);
    });
  });
});
```

### 运行测试

```bash
# 单元测试
npm run test

# 端到端测试
npm run test:e2e

# 测试覆盖率
npm run test:coverage

# 监视模式
npm run test:watch

# 特定文件测试
npm run test user.service.spec.ts
```

---

## 🐛 调试指南

### VS Code 调试配置

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug User Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/user-service/src/main.ts",
      "outFiles": ["${workspaceFolder}/services/user-service/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "sourceMaps": true,
      "cwd": "${workspaceFolder}/services/user-service"
    },
    {
      "name": "Debug Campus Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/services/campus-service/src/main.ts",
      "outFiles": ["${workspaceFolder}/services/campus-service/dist/**/*.js"],
      "env": {
        "NODE_ENV": "development",
        "PORT": "3002"
      },
      "runtimeArgs": ["-r", "ts-node/register"],
      "sourceMaps": true,
      "cwd": "${workspaceFolder}/services/campus-service"
    }
  ]
}
```

### 日志调试

#### 应用日志
```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    this.logger.log(`创建用户: ${createUserDto.email}`);
    
    try {
      const user = await this.userRepository.save(createUserDto);
      this.logger.log(`用户创建成功: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`用户创建失败: ${error.message}`, error.stack);
      throw error;
    }
  }
}
```

#### 查看服务日志
```bash
# 实时查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f user-service
docker-compose logs -f mysql
docker-compose logs -f redis

# 查看错误日志
docker-compose logs user-service | grep ERROR
```

### 数据库调试

#### 连接数据库
```bash
# 进入 MySQL 容器
docker-compose exec mysql mysql -u root -p

# 查看数据库
SHOW DATABASES;
USE user_service;
SHOW TABLES;

# 查看表结构
DESCRIBE users;

# 查询数据
SELECT * FROM users LIMIT 10;
```

#### 查看 SQL 日志
```typescript
// 在 app.module.ts 中启用 SQL 日志
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    // ... 其他配置
    logging: ['query', 'error', 'schema', 'warn', 'info', 'log'],
    logger: 'advanced-console',
  }),
});
```

### Redis 调试

```bash
# 进入 Redis 容器
docker-compose exec redis redis-cli

# 查看所有键
KEYS *

# 查看缓存内容
GET user:1
HGETALL session:abc123

# 查看 Redis 统计
INFO stats

# 监控 Redis 命令
MONITOR
```

---

## ❓ 常见问题

### 启动问题

#### Q: 服务启动失败，提示端口被占用
```bash
# 查看端口占用
lsof -i :3001
netstat -tulpn | grep 3001

# 停止占用端口的进程
kill -9 <PID>

# 或使用不同端口
PORT=3011 npm run dev
```

#### Q: 数据库连接认证错误 "Access denied for user 'root'@'localhost'"

**问题原因**: 主机系统运行了本地 MySQL 服务（端口3306），与 Docker MySQL 容器产生端口冲突。

**解决方案**:

1. **检查端口冲突**:
```bash
# 检查本地 MySQL 服务状态
systemctl status mysql
ps aux | grep mysqld

# 检查端口占用
ss -tlnp | grep 3306
```

2. **修改 Docker MySQL 端口**:
```bash
# 编辑 docker-compose.yml，将 MySQL 端口改为 3307
ports:
  - "3307:3306"

# 更新环境变量文件 .env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USERNAME=root
DB_PASSWORD=rootpassword
```

3. **重新启动容器**:
```bash
# 停止并重新创建 MySQL 容器
docker-compose down
docker-compose up -d mysql redis
```

4. **测试连接**:
```bash
# 测试 Docker MySQL 连接
mysql -h 127.0.0.1 -P 3307 -u root -prootpassword -e "SHOW DATABASES;"

# 使用新配置启动开发环境
DB_HOST=127.0.0.1 DB_PORT=3307 DB_USERNAME=root DB_PASSWORD=rootpassword npm run dev
```

**注意事项**:
- 使用 `127.0.0.1` 而不是 `localhost` 避免本地 socket 连接问题
- 确保环境变量正确传递给所有服务
- 可以选择停止本地 MySQL 服务或使用不同端口

#### Q: Redis 连接超时
```bash
# 检查 Redis 状态
docker-compose ps redis
docker-compose exec redis redis-cli ping

# 重启 Redis
docker-compose restart redis

# 检查 Redis 配置
cat .env | grep REDIS
```

### 依赖问题

#### Q: npm install 失败
```bash
# 清理缓存
npm cache clean --force
rm -rf node_modules package-lock.json

# 使用国内镜像
npm config set registry https://registry.npmmirror.com

# 重新安装
npm install
```

#### Q: TypeScript 编译错误
```bash
# 检查 TypeScript 版本
npx tsc --version

# 检查类型错误
npm run typecheck

# 重新生成类型定义
rm -rf dist
npm run build
```

### 认证问题

#### Q: JWT Token 验证失败
```bash
# 检查 JWT 密钥配置
echo $JWT_SECRET

# 重新登录获取新 token
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "password123"}'

# 检查 token 格式
echo "Bearer your-token-here" | base64 -d
```

#### Q: 权限验证失败
```bash
# 检查用户角色
curl -X GET http://localhost:3001/core/users/me \
  -H "Authorization: Bearer <token>"

# 检查 Guards 配置
grep -r "@Roles" services/*/src/
```

### 性能问题

#### Q: API 响应缓慢
```bash
# 检查数据库连接池
docker-compose logs mysql | grep "connection"

# 查看 Redis 性能
docker-compose exec redis redis-cli --latency

# 检查服务资源使用
docker stats
```

#### Q: 内存使用过高
```bash
# 查看内存使用
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# 重启服务释放内存
docker-compose restart user-service
```

### 开发工具问题

#### Q: VS Code 类型提示不工作
```bash
# 重启 TypeScript 服务
Ctrl+Shift+P > "TypeScript: Restart TS Server"

# 重新生成类型定义
npm run build

# 检查 tsconfig.json 配置
```

#### Q: ESLint 规则冲突
```bash
# 查看 ESLint 配置
cat .eslintrc.js

# 自动修复代码风格
npm run lint:fix

# 禁用特定规则
// eslint-disable-next-line @typescript-eslint/no-unused-vars
```

### 获取帮助

1. **查看文档**: 检查 `README.md` 和 `PROJECT_STATUS.md`
2. **查看日志**: 使用 `docker-compose logs` 查看详细错误信息
3. **检查配置**: 验证 `.env` 文件中的配置项
4. **清理重启**: 停止所有服务，清理缓存，重新启动
5. **社区支持**: 在 GitHub Issues 中报告问题

---

## 📞 技术支持

- **文档**: 各服务的 `/api/docs` 端点
- **监控**: `/healthz` 和 `/readyz` 端点
- **日志**: `docker-compose logs` 命令
- **问题反馈**: GitHub Issues

---

<div align="center">

**🚀 祝你开发愉快！**

</div>