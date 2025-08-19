#!/bin/bash

# 数据库表结构详细验证脚本

echo "🔍 开始验证数据库表结构和字段"
echo "=========================================="

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

# 验证函数
verify_table_schema() {
    local db_name=$1
    local table_name=$2
    
    echo "📋 检查 $db_name.$table_name 表结构："
    
    # 获取表结构
    mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << EOF 2>/dev/null
USE $db_name;
DESCRIBE $table_name;
EOF
    
    echo ""
    
    # 获取索引信息
    echo "🔍 索引信息："
    mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << EOF 2>/dev/null
USE $db_name;
SHOW INDEX FROM $table_name;
EOF
    
    echo ""
    echo "----------------------------------------"
}

# 验证 user_service 数据库
echo "1️⃣ 验证 user_service 数据库"
echo "=========================================="

verify_table_schema "user_service" "role"
verify_table_schema "user_service" "user" 
verify_table_schema "user_service" "audit_log"
verify_table_schema "user_service" "user_role"

# 验证 campus_service 数据库
echo ""
echo "2️⃣ 验证 campus_service 数据库"
echo "=========================================="

verify_table_schema "campus_service" "org"
verify_table_schema "campus_service" "campus"
verify_table_schema "campus_service" "classroom"
verify_table_schema "campus_service" "tax_profile"
verify_table_schema "campus_service" "campus_billing_profile"
verify_table_schema "campus_service" "audit_log"

# 验证 payroll_service 数据库
echo ""
echo "3️⃣ 验证 payroll_service 数据库"
echo "=========================================="

verify_table_schema "payroll_service" "user_compensation"
verify_table_schema "payroll_service" "payroll_run"
verify_table_schema "payroll_service" "audit_log"

# 检查关键字段类型和约束
echo ""
echo "4️⃣ 关键字段验证"
echo "=========================================="

echo "🔍 检查用户表关键字段..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
USE user_service;
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_KEY,
    EXTRA
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'user_service' 
  AND TABLE_NAME = 'user'
  AND COLUMN_NAME IN ('user_id', 'org_id', 'username', 'email', 'phone', 'employment_status')
ORDER BY ORDINAL_POSITION;
EOF

echo ""
echo "🔍 检查校区表关键字段..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
USE campus_service;
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_KEY,
    EXTRA
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'campus_service' 
  AND TABLE_NAME = 'campus'
  AND COLUMN_NAME IN ('campus_id', 'org_id', 'name', 'code', 'status', 'type')
ORDER BY ORDINAL_POSITION;
EOF

echo ""
echo "🔍 检查工资单表关键字段..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
USE payroll_service;
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_KEY,
    EXTRA
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'payroll_service' 
  AND TABLE_NAME = 'payroll_run'
  AND COLUMN_NAME IN ('run_id', 'org_id', 'user_id', 'payroll_month', 'status')
ORDER BY ORDINAL_POSITION;
EOF

# 检查外键约束
echo ""
echo "5️⃣ 外键约束验证"
echo "=========================================="

echo "🔗 user_service 外键约束："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'user_service' 
  AND REFERENCED_TABLE_NAME IS NOT NULL;
EOF

echo ""
echo "🔗 campus_service 外键约束："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'campus_service' 
  AND REFERENCED_TABLE_NAME IS NOT NULL;
EOF

echo ""
echo "🔗 payroll_service 外键约束："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'payroll_service' 
  AND REFERENCED_TABLE_NAME IS NOT NULL;
EOF

# 检查唯一约束
echo ""
echo "6️⃣ 唯一约束验证"
echo "=========================================="

echo "🔑 user_service 唯一约束："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    INDEX_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'user_service'
  AND NON_UNIQUE = 0
  AND INDEX_NAME != 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME;
EOF

echo ""
echo "🔑 campus_service 唯一约束："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    INDEX_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'campus_service'
  AND NON_UNIQUE = 0
  AND INDEX_NAME != 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME;
EOF

echo ""
echo "🔑 payroll_service 唯一约束："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS << 'EOF' 2>/dev/null
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    INDEX_NAME
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'payroll_service'
  AND NON_UNIQUE = 0
  AND INDEX_NAME != 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME;
EOF

echo ""
echo "=========================================="
echo "✅ 数据库表结构验证完成！"