#!/bin/bash

# Backup Orchestrator for EduHub System
# This script coordinates all backup operations

set -e

# Configuration
BACKUP_ROOT="/var/backups"
LOG_FILE="/var/log/backup-orchestrator.log"
DATE=$(date +%Y%m%d_%H%M%S)
PARALLEL_JOBS=2

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directories
mkdir -p "$BACKUP_ROOT"/{mysql,redis,minio}

log "Starting EduHub backup orchestration"

# Function to run backup with timeout and retry
run_backup_with_retry() {
    local script=$1
    local max_attempts=3
    local timeout=3600  # 1 hour timeout
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log "Attempting $script (attempt $attempt/$max_attempts)"
        
        if timeout $timeout bash "$script"; then
            log "✅ $script completed successfully"
            return 0
        else
            local exit_code=$?
            if [ $exit_code -eq 124 ]; then
                log "❌ $script timed out after ${timeout}s (attempt $attempt)"
            else
                log "❌ $script failed with exit code $exit_code (attempt $attempt)"
            fi
            
            if [ $attempt -eq $max_attempts ]; then
                log "❌ $script failed after $max_attempts attempts"
                return 1
            fi
            
            # Wait before retry (exponential backoff)
            local wait_time=$((attempt * 30))
            log "Waiting ${wait_time}s before retry..."
            sleep $wait_time
            
            attempt=$((attempt + 1))
        fi
    done
}

# Pre-backup health checks
log "Running pre-backup health checks"

health_check_passed=true

# Check MySQL connectivity
if ! mysqladmin ping -h "${DB_MASTER_HOST:-mysql-master}" -P "${DB_MASTER_PORT:-3306}" \
     -u "${DB_USERNAME:-root}" -p"${DB_MASTER_PASSWORD:-rootpassword}" --silent 2>/dev/null; then
    log "❌ MySQL health check failed"
    health_check_passed=false
fi

# Check Redis connectivity
REDIS_CMD="redis-cli -h ${REDIS_HOST:-redis} -p ${REDIS_PORT:-6379}"
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CMD="$REDIS_CMD -a $REDIS_PASSWORD"
fi

if ! $REDIS_CMD ping | grep -q PONG 2>/dev/null; then
    log "❌ Redis health check failed"
    health_check_passed=false
fi

# Check MinIO connectivity (optional)
if [ "$ENABLE_MINIO_BACKUP" = "true" ]; then
    if ! curl -f "http://${MINIO_ENDPOINT:-minio:9000}/minio/health/live" >/dev/null 2>&1; then
        log "❌ MinIO health check failed"
        health_check_passed=false
    fi
fi

if [ "$health_check_passed" = false ]; then
    log "❌ Pre-backup health checks failed. Aborting backup process."
    exit 1
fi

log "✅ All pre-backup health checks passed"

# Create backup metadata
METADATA_FILE="$BACKUP_ROOT/backup_metadata_${DATE}.json"
{
    echo "{"
    echo "  \"backup_id\": \"${DATE}\","
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"version\": \"1.0\","
    echo "  \"components\": ["
    echo "    \"mysql\","
    echo "    \"redis\""
    [ "$ENABLE_MINIO_BACKUP" = "true" ] && echo "    ,\"minio\""
    echo "  ],"
    echo "  \"retention_days\": ${RETENTION_DAYS:-7},"
    echo "  \"backup_type\": \"full\","
    echo "  \"initiated_by\": \"orchestrator\""
    echo "}"
} > "$METADATA_FILE"

# Run backups in parallel or sequential based on configuration
if [ "$PARALLEL_BACKUPS" = "true" ]; then
    log "Running backups in parallel mode"
    
    # Start MySQL backup in background
    {
        log "Starting MySQL backup (background)"
        run_backup_with_retry "./mysql-backup.sh"
    } &
    mysql_backup_pid=$!
    
    # Start Redis backup in background  
    {
        log "Starting Redis backup (background)"
        run_backup_with_retry "./redis-backup.sh"
    } &
    redis_backup_pid=$!
    
    # Wait for both backups to complete
    mysql_success=true
    redis_success=true
    
    if ! wait $mysql_backup_pid; then
        mysql_success=false
        log "❌ MySQL backup failed"
    fi
    
    if ! wait $redis_backup_pid; then
        redis_success=false
        log "❌ Redis backup failed"
    fi
    
    # Check results
    if [ "$mysql_success" = true ] && [ "$redis_success" = true ]; then
        log "✅ All parallel backups completed successfully"
    else
        log "❌ One or more parallel backups failed"
        exit 1
    fi
    
else
    log "Running backups in sequential mode"
    
    # Sequential backup execution
    if ! run_backup_with_retry "./mysql-backup.sh"; then
        log "❌ MySQL backup failed, aborting remaining backups"
        exit 1
    fi
    
    if ! run_backup_with_retry "./redis-backup.sh"; then
        log "❌ Redis backup failed"
        exit 1
    fi
    
    log "✅ All sequential backups completed successfully"
fi

# MinIO/S3 backup (if enabled)
if [ "$ENABLE_MINIO_BACKUP" = "true" ]; then
    log "Starting MinIO/S3 data backup"
    
    # Use mc (MinIO Client) or AWS CLI to backup bucket contents
    if command -v mc &> /dev/null; then
        # Using MinIO client
        MINIO_BACKUP_DIR="$BACKUP_ROOT/minio/backup_${DATE}"
        mkdir -p "$MINIO_BACKUP_DIR"
        
        mc alias set local "http://${MINIO_ENDPOINT:-minio:9000}" \
            "${MINIO_ACCESS_KEY:-admin}" "${MINIO_SECRET_KEY:-password123}"
        
        if mc mirror local/"${STORAGE_BUCKET:-eduhub-files}" "$MINIO_BACKUP_DIR"; then
            # Create tarball
            cd "$BACKUP_ROOT/minio"
            if tar -czf "minio_backup_${DATE}.tar.gz" "backup_${DATE}"; then
                rm -rf "backup_${DATE}"
                log "✅ MinIO backup completed: minio_backup_${DATE}.tar.gz"
            else
                log "❌ Failed to create MinIO backup tarball"
            fi
        else
            log "❌ Failed to mirror MinIO bucket"
        fi
    else
        log "⚠️ MinIO client (mc) not available, skipping MinIO backup"
    fi
fi

# Generate backup report
REPORT_FILE="$BACKUP_ROOT/backup_report_${DATE}.txt"
{
    echo "EduHub Backup Report"
    echo "==================="
    echo "Date: $(date)"
    echo "Backup ID: $DATE"
    echo ""
    echo "Backup Status:"
    
    # MySQL backups
    if ls "$BACKUP_ROOT/mysql"/*_${DATE}.sql.gz >/dev/null 2>&1; then
        echo "✅ MySQL: Success"
        MYSQL_COUNT=$(ls -1 "$BACKUP_ROOT/mysql"/*_${DATE}.sql.gz | wc -l)
        MYSQL_SIZE=$(du -sh "$BACKUP_ROOT/mysql"/*_${DATE}.sql.gz | awk '{sum+=$1} END {print sum}')
        echo "   - Files: $MYSQL_COUNT"
        echo "   - Size: $MYSQL_SIZE"
    else
        echo "❌ MySQL: Failed"
    fi
    
    # Redis backups
    if ls "$BACKUP_ROOT/redis"/*_${DATE}.*.gz >/dev/null 2>&1; then
        echo "✅ Redis: Success"
        REDIS_COUNT=$(ls -1 "$BACKUP_ROOT/redis"/*_${DATE}.*.gz | wc -l)
        REDIS_SIZE=$(du -sh "$BACKUP_ROOT/redis"/*_${DATE}.*.gz | awk '{sum+=$1} END {print sum}')
        echo "   - Files: $REDIS_COUNT"
        echo "   - Size: $REDIS_SIZE"
    else
        echo "❌ Redis: Failed"
    fi
    
    # MinIO backups
    if [ "$ENABLE_MINIO_BACKUP" = "true" ] && [ -f "$BACKUP_ROOT/minio/minio_backup_${DATE}.tar.gz" ]; then
        echo "✅ MinIO: Success"
        MINIO_SIZE=$(du -sh "$BACKUP_ROOT/minio/minio_backup_${DATE}.tar.gz" | cut -f1)
        echo "   - Size: $MINIO_SIZE"
    elif [ "$ENABLE_MINIO_BACKUP" = "true" ]; then
        echo "❌ MinIO: Failed"
    else
        echo "⏭️  MinIO: Skipped (not enabled)"
    fi
    
    echo ""
    echo "Total Backup Size: $(du -sh "$BACKUP_ROOT" | cut -f1)"
    echo ""
    echo "Retention Policy: ${RETENTION_DAYS:-7} days"
    echo "Next Backup: $(date -d '+1 day' '+%Y-%m-%d %H:%M:%S')"
    
} > "$REPORT_FILE"

log "Backup report generated: $REPORT_FILE"

# Send notification
if [ "$BACKUP_NOTIFICATION_WEBHOOK" ]; then
    TOTAL_SIZE=$(du -sh "$BACKUP_ROOT" | cut -f1)
    SUCCESS_COUNT=0
    
    [ -f "$BACKUP_ROOT/mysql"/*_${DATE}.sql.gz ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    [ -f "$BACKUP_ROOT/redis"/*_${DATE}.*.gz ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    [ "$ENABLE_MINIO_BACKUP" = "true" ] && [ -f "$BACKUP_ROOT/minio/minio_backup_${DATE}.tar.gz" ] && SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    
    curl -X POST "$BACKUP_NOTIFICATION_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"🔄 EduHub Backup Orchestration Completed\",
            \"details\": {
                \"backup_id\": \"$DATE\",
                \"timestamp\": \"$(date -Iseconds)\",
                \"components_backed_up\": $SUCCESS_COUNT,
                \"total_size\": \"$TOTAL_SIZE\",
                \"report_file\": \"$REPORT_FILE\"
            }
        }" || log "WARNING: Failed to send backup notification"
fi

log "✅ Backup orchestration completed successfully"
log "Backup ID: $DATE"
log "Report: $REPORT_FILE"

exit 0