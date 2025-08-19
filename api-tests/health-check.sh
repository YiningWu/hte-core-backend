#!/bin/bash

# 健康检查API测试脚本

# 读取配置
CONFIG_FILE="test-config.json"
USER_SERVICE_URL=$(cat $CONFIG_FILE | jq -r '.baseUrls.userService')
CAMPUS_SERVICE_URL=$(cat $CONFIG_FILE | jq -r '.baseUrls.campusService')
PAYROLL_SERVICE_URL=$(cat $CONFIG_FILE | jq -r '.baseUrls.payrollService')

echo "=== EduHub 服务健康检查 ==="
echo ""

# 健康检查函数
check_health() {
    local service_name=$1
    local url=$2
    
    echo "检查 $service_name..."
    
    # 健康检查
    HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$url/healthz")
    HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE/d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ $service_name 健康检查: 通过"
        echo "   响应: $RESPONSE_BODY" | jq . 2>/dev/null || echo "   响应: $RESPONSE_BODY"
    else
        echo "❌ $service_name 健康检查: 失败 (状态码: $HTTP_CODE)"
    fi
    
    # 就绪检查
    READY_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$url/readyz")
    HTTP_CODE=$(echo "$READY_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    RESPONSE_BODY=$(echo "$READY_RESPONSE" | sed '/HTTP_CODE/d')
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ $service_name 就绪检查: 通过"
        echo "   响应: $RESPONSE_BODY" | jq . 2>/dev/null || echo "   响应: $RESPONSE_BODY"
    else
        echo "❌ $service_name 就绪检查: 失败 (状态码: $HTTP_CODE)"
    fi
    
    echo ""
}

# 检查所有服务
check_health "用户服务" $USER_SERVICE_URL
check_health "校区服务" $CAMPUS_SERVICE_URL  
check_health "薪资服务" $PAYROLL_SERVICE_URL

echo "=== 健康检查完成 ==="

# 检查API文档是否可访问
echo ""
echo "=== API文档可用性检查 ==="

check_docs() {
    local service_name=$1
    local url=$2
    
    DOCS_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X GET "$url/api/docs")
    HTTP_CODE=$(echo "$DOCS_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ $service_name API文档: 可访问 ($url/api/docs)"
    else
        echo "❌ $service_name API文档: 不可访问 (状态码: $HTTP_CODE)"
    fi
}

check_docs "用户服务" $USER_SERVICE_URL
check_docs "校区服务" $CAMPUS_SERVICE_URL
check_docs "薪资服务" $PAYROLL_SERVICE_URL

echo ""
echo "=== 文档检查完成 ==="