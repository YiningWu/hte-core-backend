#!/bin/bash

# 数据库表结构验证和同步脚本

echo "🔍 开始验证数据库表结构"
echo "======================================"

DB_HOST="127.0.0.1"
DB_PORT="3307"
DB_USER="root"
DB_PASS="rootpassword"

# 检查数据库连接
echo "1. 检查数据库连接..."
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 数据库连接正常"
else
    echo "❌ 数据库连接失败"
    exit 1
fi

echo ""

# 检查数据库是否存在
echo "2. 检查数据库存在性..."
for db in user_service campus_service payroll_service; do
    result=$(mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "SHOW DATABASES LIKE '$db';" 2>/dev/null | grep $db)
    if [ -n "$result" ]; then
        echo "✅ 数据库 $db 存在"
    else
        echo "❌ 数据库 $db 不存在"
    fi
done

echo ""

# 检查每个数据库的表
echo "3. 检查各数据库的表结构..."

echo ""
echo "📋 user_service 数据库表："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "USE user_service; SHOW TABLES;" 2>/dev/null || echo "❌ 无法访问 user_service"

echo ""
echo "📋 campus_service 数据库表："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "USE campus_service; SHOW TABLES;" 2>/dev/null || echo "❌ 无法访问 campus_service"

echo ""
echo "📋 payroll_service 数据库表："
mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "USE payroll_service; SHOW TABLES;" 2>/dev/null || echo "❌ 无法访问 payroll_service"

echo ""
echo "======================================"

# 定义期望的表结构
echo "4. 验证期望的表是否存在..."

declare -A expected_tables
expected_tables[user_service]="role user audit_log user_role"
expected_tables[campus_service]="org classroom tax_profile campus_billing_profile campus audit_log"
expected_tables[payroll_service]="user_compensation payroll_run audit_log"

all_tables_exist=true

for db in user_service campus_service payroll_service; do
    echo ""
    echo "🔍 检查 $db 数据库..."
    
    for table in ${expected_tables[$db]}; do
        result=$(mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "USE $db; SHOW TABLES LIKE '$table';" 2>/dev/null | grep $table)
        if [ -n "$result" ]; then
            echo "  ✅ 表 $table 存在"
        else
            echo "  ❌ 表 $table 缺失"
            all_tables_exist=false
        fi
    done
done

echo ""
echo "======================================"

if [ "$all_tables_exist" = true ]; then
    echo "🎉 所有必需的表都已创建！"
else
    echo "⚠️  部分表缺失，需要运行数据库同步"
    echo ""
    echo "建议操作："
    echo "1. 检查 TypeORM 实体定义"
    echo "2. 确保 NODE_ENV=development (启用自动同步)"
    echo "3. 重启相关服务让 TypeORM 创建缺失的表"
fi

echo ""
echo "5. 检查基础数据..."

# 检查是否有基础数据 (用户、角色等)
echo ""
echo "📊 基础数据检查："

# 检查 user_service 中是否有测试用户
user_count=$(mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "USE user_service; SELECT COUNT(*) FROM user;" 2>/dev/null | tail -n 1)
if [ "$user_count" -gt 0 ] 2>/dev/null; then
    echo "  ✅ user 表有 $user_count 条记录"
else
    echo "  ⚠️  user 表为空或不存在"
fi

# 检查角色数据
role_count=$(mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS -e "USE user_service; SELECT COUNT(*) FROM role;" 2>/dev/null | tail -n 1)
if [ "$role_count" -gt 0 ] 2>/dev/null; then
    echo "  ✅ role 表有 $role_count 条记录"
else
    echo "  ⚠️  role 表为空或不存在"
fi

echo ""
echo "======================================"
echo "🏁 数据库验证完成！"