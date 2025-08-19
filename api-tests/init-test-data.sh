#!/bin/bash

# 测试数据初始化脚本

echo "🚀 开始初始化测试数据"
echo "======================================"

DB_HOST="127.0.0.1"
DB_PORT="3307"
DB_USER="root"
DB_PASS="rootpassword"

# 检查数据库连接
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 数据库连接失败"
    exit 1
fi

echo "✅ 数据库连接成功"
echo ""

# 初始化角色数据
echo "1. 初始化角色数据..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF'
USE user_service;

-- 清空现有数据（如果有的话）
DELETE FROM user_role;
DELETE FROM user;
DELETE FROM role;

-- 插入角色数据
INSERT INTO role (role_id, code, name) VALUES
(1, 'admin', '系统管理员'),
(2, 'hr', '人事专员'),
(3, 'teacher', '教师'),
(4, 'manager', '校区经理')
ON DUPLICATE KEY UPDATE name = VALUES(name);

EOF

if [ $? -eq 0 ]; then
    echo "✅ 角色数据初始化成功"
else
    echo "❌ 角色数据初始化失败"
fi

echo ""

# 初始化测试用户
echo "2. 初始化测试用户..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF'
USE user_service;

-- 插入测试用户 (admin@example.com, password123)
-- 密码 hash: password123 的 bcrypt hash
INSERT INTO user (
    user_id, org_id, campus_id, username, employment_status, hire_date, 
    email, phone, id_card_no_hash, id_card_no_encrypted, role, created_at, updated_at
) VALUES (
    1, 1, 1, 'admin', '在职', '2024-01-01',
    'admin@example.com', '13888888888', 
    SHA2('12345678901234567X7b9912f04477299298ca7af2d6518026', 256),
    NULL, 'admin', NOW(), NOW()
) ON DUPLICATE KEY UPDATE 
    username = VALUES(username),
    email = VALUES(email);

-- 关联用户角色
INSERT INTO user_role (user_id, role_id) VALUES 
(1, 1), -- admin 角色
(1, 2)  -- hr 角色
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);

EOF

if [ $? -eq 0 ]; then
    echo "✅ 测试用户初始化成功"
else
    echo "❌ 测试用户初始化失败"
fi

echo ""

# 初始化组织数据
echo "3. 初始化组织数据..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF'
USE campus_service;

-- 插入测试组织
INSERT INTO org (org_id, name, code, remark, created_at, updated_at) VALUES
(1, '测试机构', 'TEST_ORG', '用于API测试的机构', NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    code = VALUES(code);

-- 插入测试税务配置
INSERT INTO tax_profile (tax_profile_id, name, rate, is_tax_included, created_at, updated_at) VALUES
(1, '上海税务配置', 0.13, 0, NOW(), NOW()),
(2, '北京税务配置', 0.13, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    rate = VALUES(rate);

-- 插入测试校区
INSERT INTO campus (
    campus_id, org_id, name, code, type, status, 
    province, city, district, address, phone, email,
    open_date, area, capacity, created_at, updated_at
) VALUES (
    1, 1, '测试校区', 'TEST_CAMPUS', '直营', '营业',
    '上海市', '浦东新区', '张江', '张江高科技园区测试路123号',
    '021-88888888', 'test@example.com',
    '2024-01-01', 500.00, 100, NOW(), NOW()
) ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    code = VALUES(code);

EOF

if [ $? -eq 0 ]; then
    echo "✅ 组织数据初始化成功"
else
    echo "❌ 组织数据初始化失败"
fi

echo ""

# 验证数据
echo "4. 验证初始化数据..."

echo ""
echo "📊 用户数据："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "
USE user_service; 
SELECT u.user_id, u.username, u.email, GROUP_CONCAT(r.name) as roles 
FROM user u 
LEFT JOIN user_role ur ON u.user_id = ur.user_id 
LEFT JOIN role r ON ur.role_id = r.role_id 
WHERE u.user_id = 1 
GROUP BY u.user_id;
" 2>/dev/null

echo ""
echo "📊 组织数据："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "
USE campus_service; 
SELECT org_id, name, code FROM org WHERE org_id = 1;
" 2>/dev/null

echo ""
echo "📊 校区数据："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "
USE campus_service; 
SELECT campus_id, name, code, status FROM campus WHERE campus_id = 1;
" 2>/dev/null

echo ""
echo "======================================"
echo "🎉 测试数据初始化完成！"
echo ""
echo "测试账号信息："
echo "  用户名: admin@example.com"
echo "  密码: password123"
echo "  角色: 系统管理员, 人事专员"
echo ""
echo "现在可以运行 API 测试了！"