# EduHub 生产环境部署指南

本文档专注于生产环境部署配置。开发环境请参考 [README.md](README.md)。

---

## 📋 目录

- [系统要求](#-系统要求)
- [快速部署](#-快速部署)
- [生产环境配置](#-生产环境配置)
- [容器化部署](#-容器化部署)
- [Kubernetes 部署](#-kubernetes-部署)
- [监控运维](#-监控运维)
- [安全加固](#-安全加固)
- [备份恢复](#-备份恢复)

---

## 🖥️ 系统要求

### 生产环境推荐配置
- **CPU**: 8+ 核心
- **内存**: 32GB+ RAM
- **存储**: 200GB+ NVMe SSD
- **网络**: 1Gbps+
- **OS**: Ubuntu 20.04 LTS+ / CentOS 8+ / RHEL 8+

### 必需软件
- **Docker**: v24.0+
- **Docker Compose**: v2.0+
- **Git**: v2.30+

---

## 🚀 快速部署

### 一键部署脚本

创建部署脚本 `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 开始部署 EduHub 生产环境..."

# 1. 克隆项目
if [ ! -d "hte-core-backend" ]; then
    git clone <your-repository-url> hte-core-backend
fi
cd hte-core-backend

# 2. 环境配置
echo "📝 配置环境变量..."
cp .env.example .env.production

# 提示用户编辑环境变量
echo "⚠️  请编辑 .env.production 文件，配置生产环境参数"
echo "按任意键继续..."
read -n 1

# 3. 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose -f docker-compose.production.yml build

# 4. 启动服务
echo "🚀 启动生产服务..."
docker-compose -f docker-compose.production.yml up -d

# 5. 健康检查
echo "🔍 等待服务启动..."
sleep 30

echo "✅ 检查服务状态..."
curl -f http://localhost:3001/healthz || echo "❌ User Service 启动失败"
curl -f http://localhost:3002/healthz || echo "❌ Campus Service 启动失败"
curl -f http://localhost:3003/healthz || echo "❌ Payroll Service 启动失败"

echo "🎉 部署完成！"
echo "📊 监控面板: http://localhost:3000 (Grafana)"
echo "📚 API 文档: http://localhost:3001/api/docs"
```

### 执行部署

```bash
# 下载部署脚本
wget https://raw.githubusercontent.com/your-org/hte-core-backend/main/scripts/deploy.sh

# 赋予执行权限
chmod +x deploy.sh

# 执行部署
./deploy.sh
```

---

## ⚙️ 生产环境配置

### 环境变量配置

创建 `.env.production`:

```env
# 环境标识
NODE_ENV=production

# 数据库配置 (生产环境)
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USERNAME=eduhub_user
DB_PASSWORD=your-very-secure-database-password
DB_SSL_MODE=require

# 数据库连接池
DB_CONNECTION_LIMIT=20
DB_CONNECTION_TIMEOUT=60000

# Redis 配置 (生产环境)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-redis-password
REDIS_DB=0
REDIS_TLS=true

# 安全配置
JWT_SECRET=your-256-bit-production-jwt-secret-key-must-be-very-long-and-secure
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY=your-32-char-encryption-key-prod

# 服务配置 (内网地址)
USER_SERVICE_URL=http://user-service:3001
CAMPUS_SERVICE_URL=http://campus-service:3002
PAYROLL_SERVICE_URL=http://payroll-service:3003

# 外部域名 (对外访问)
PUBLIC_USER_SERVICE_URL=https://api.yourdomain.com/user
PUBLIC_CAMPUS_SERVICE_URL=https://api.yourdomain.com/campus
PUBLIC_PAYROLL_SERVICE_URL=https://api.yourdomain.com/payroll

# CORS 配置
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com

# 性能配置
DEFAULT_CACHE_TTL=1800
USER_CACHE_TTL=3600
CAMPUS_CACHE_TTL=3600
COMPENSATION_CACHE_TTL=7200

# 限流配置 (生产环境更严格)
GLOBAL_RATE_LIMIT_MAX=500
GLOBAL_RATE_LIMIT_WINDOW=3600
ENABLE_RATE_LIMITING=true

# 日志配置
LOG_LEVEL=info
LOG_FORMAT=json

# 文件存储 (云存储)
FILE_STORAGE_TYPE=s3
AWS_S3_BUCKET=your-eduhub-files
AWS_S3_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# 监控配置
ENABLE_METRICS=true
METRICS_PORT=9090

# 安全配置
HELMET_CSP=true
HELMET_HSTS=true
TRUST_PROXY=true
```

---

## 🐳 容器化部署

### Docker Compose 生产配置

创建 `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  # 用户服务
  user-service:
    build:
      context: ./services/user-service
      dockerfile: Dockerfile
      target: production
    container_name: eduhub-user-service
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - .env.production
    ports:
      - "3001:3001"
    depends_on:
      - mysql-master
      - redis-cluster
    networks:
      - eduhub-network
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # 校区服务
  campus-service:
    build:
      context: ./services/campus-service
      dockerfile: Dockerfile
      target: production
    container_name: eduhub-campus-service
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3002
    env_file:
      - .env.production
    ports:
      - "3002:3002"
    depends_on:
      - mysql-master
      - redis-cluster
    networks:
      - eduhub-network
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 1.5G
        reservations:
          cpus: '0.5'
          memory: 512M

  # 薪资服务
  payroll-service:
    build:
      context: ./services/payroll-service
      dockerfile: Dockerfile
      target: production
    container_name: eduhub-payroll-service
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - PORT=3003
    env_file:
      - .env.production
    ports:
      - "3003:3003"
    depends_on:
      - mysql-master
      - redis-cluster
    networks:
      - eduhub-network
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3003/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M

  # MySQL 主库
  mysql-master:
    image: mysql:8.0
    container_name: eduhub-mysql-master
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_CHARACTER_SET_SERVER: utf8mb4
      MYSQL_COLLATION_SERVER: utf8mb4_unicode_ci
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
      - ./docker/mysql/master.cnf:/etc/mysql/conf.d/master.cnf
      - ./docker/mysql/init:/docker-entrypoint-initdb.d
      - ./backups/mysql:/backups
    networks:
      - eduhub-network
    command: --default-authentication-plugin=mysql_native_password
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '1.0'
          memory: 2G

  # Redis 集群
  redis-cluster:
    image: redis:7.0-alpine
    container_name: eduhub-redis-cluster
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      - ./docker/redis/redis.conf:/usr/local/etc/redis/redis.conf
    networks:
      - eduhub-network
    command: redis-server /usr/local/etc/redis/redis.conf --requirepass ${REDIS_PASSWORD}
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '0.5'
          memory: 1G

  # Nginx 负载均衡
  nginx:
    image: nginx:1.24-alpine
    container_name: eduhub-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.prod.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
      - ./logs/nginx:/var/log/nginx
    networks:
      - eduhub-network
    depends_on:
      - user-service
      - campus-service
      - payroll-service
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

  # Prometheus 监控
  prometheus:
    image: prom/prometheus:v2.45.0
    container_name: eduhub-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - eduhub-network
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=15d'
      - '--web.enable-lifecycle'

  # Grafana 可视化
  grafana:
    image: grafana/grafana:10.0.0
    container_name: eduhub-grafana
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/provisioning:/etc/grafana/provisioning
    networks:
      - eduhub-network
    depends_on:
      - prometheus

volumes:
  mysql_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local

networks:
  eduhub-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

---

## ☸️ Kubernetes 部署

### 基本部署清单

#### 命名空间
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: eduhub
  labels:
    name: eduhub
```

#### ConfigMap
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: eduhub-config
  namespace: eduhub
data:
  NODE_ENV: "production"
  DB_HOST: "mysql-service"
  DB_PORT: "3306"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  USER_SERVICE_URL: "http://user-service:3001"
  CAMPUS_SERVICE_URL: "http://campus-service:3002"
  PAYROLL_SERVICE_URL: "http://payroll-service:3003"
```

#### 用户服务部署
```yaml
# k8s/user-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
  namespace: eduhub
  labels:
    app: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
      - name: user-service
        image: eduhub/user-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: PORT
          value: "3001"
        envFrom:
        - configMapRef:
            name: eduhub-config
        - secretRef:
            name: eduhub-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /healthz
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /readyz
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Helm Chart 部署

```bash
# 安装 Helm Chart
helm install eduhub ./k8s/helm/eduhub \
  --namespace eduhub \
  --create-namespace \
  --values ./k8s/helm/eduhub/values.production.yaml

# 升级部署
helm upgrade eduhub ./k8s/helm/eduhub \
  --namespace eduhub \
  --values ./k8s/helm/eduhub/values.production.yaml

# 回滚部署
helm rollback eduhub 1 --namespace eduhub
```

---

## 📊 监控运维

### Prometheus 配置

```yaml
# docker/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'user-service'
    static_configs:
      - targets: ['user-service:3001']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'campus-service'
    static_configs:
      - targets: ['campus-service:3002']
    metrics_path: '/metrics'

  - job_name: 'payroll-service'
    static_configs:
      - targets: ['payroll-service:3003']
    metrics_path: '/metrics'

  - job_name: 'mysql'
    static_configs:
      - targets: ['mysql-exporter:9104']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']
```

---

## 🔒 安全加固

### 服务器安全配置

#### 防火墙设置
```bash
# UFW 防火墙配置
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# 启用防火墙
sudo ufw enable
```

### 数据库安全
```sql
-- 创建专用数据库用户
CREATE USER 'eduhub_user'@'%' IDENTIFIED BY 'very_secure_password';

-- 授予最小权限
GRANT SELECT, INSERT, UPDATE, DELETE ON user_service.* TO 'eduhub_user'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_service.* TO 'eduhub_user'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE ON payroll_service.* TO 'eduhub_user'@'%';

-- 刷新权限
FLUSH PRIVILEGES;
```

### SSL/TLS 证书

#### Let's Encrypt 自动证书
```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取证书
sudo certbot --nginx -d api.yourdomain.com

# 自动续期
sudo crontab -e
# 添加：0 3 * * * certbot renew --quiet
```

---

## 💾 备份恢复

### 自动备份脚本

```bash
#!/bin/bash
# scripts/backup.sh

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

echo "🗄️ 开始备份 EduHub 数据..."

# MySQL 备份
echo "📊 备份 MySQL 数据库..."
docker-compose exec -T mysql-master mysqldump \
  --all-databases \
  --single-transaction \
  --routines \
  --triggers \
  -u root -p$DB_PASSWORD > $BACKUP_DIR/mysql_backup_$DATE.sql

# Redis 备份
echo "🔴 备份 Redis 数据..."
docker-compose exec -T redis-cluster redis-cli \
  --rdb /data/dump.rdb BGSAVE
cp ./data/redis/dump.rdb $BACKUP_DIR/redis_backup_$DATE.rdb

# 清理旧备份
echo "🧹 清理旧备份文件..."
find $BACKUP_DIR -name "*.sql" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb" -mtime +$RETENTION_DAYS -delete

echo "✅ 备份完成！"
```

### 设置定时备份

```bash
# 添加到 crontab
crontab -e

# 每天凌晨 2 点备份
0 2 * * * /path/to/hte-core-backend/scripts/backup.sh

# 每周日备份到云存储
0 3 * * 0 /path/to/hte-core-backend/scripts/backup-to-cloud.sh
```

---

## 🚨 故障排除

### 常见问题诊断

#### 服务无法启动
```bash
# 检查服务状态
docker-compose ps

# 查看服务日志
docker-compose logs user-service

# 检查端口占用
netstat -tulpn | grep :3001

# 检查资源使用
docker stats
```

#### 数据库连接问题
```bash
# 测试数据库连接
docker-compose exec mysql-master mysql -u root -p -e "SELECT 1"

# 检查数据库进程
docker-compose exec mysql-master mysqladmin -u root -p processlist

# 查看错误日志
docker-compose logs mysql-master | grep ERROR
```

### 应急处理流程

#### 服务降级
```bash
# 停止非关键服务
docker-compose stop grafana prometheus

# 扩容关键服务
docker-compose up -d --scale user-service=3

# 启用只读模式
# 通过环境变量 READ_ONLY_MODE=true
```

#### 快速回滚
```bash
# Docker Compose 回滚
docker-compose down
git checkout previous-stable-commit
docker-compose up -d

# Kubernetes 回滚
kubectl rollout undo deployment/user-service -n eduhub
```

---

## 📞 技术支持

### 监控告警

设置关键指标告警:

- **服务可用性**: < 99.9%
- **响应时间**: > 2s (P95)
- **错误率**: > 1%
- **数据库连接数**: > 80%
- **内存使用**: > 85%
- **磁盘使用**: > 90%

### 运维检查清单

#### 日常检查 (每日)
- [ ] 服务健康状态
- [ ] 错误日志审查
- [ ] 性能指标检查
- [ ] 备份状态确认

#### 周期检查 (每周)
- [ ] 系统资源使用趋势
- [ ] 数据库性能分析
- [ ] 安全更新检查
- [ ] 备份恢复测试

---

<div align="center">

**🎯 EduHub 生产环境部署完成！**

**如有问题，请查看日志或联系技术支持团队**

</div>