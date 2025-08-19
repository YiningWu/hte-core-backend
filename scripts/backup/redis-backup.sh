#!/bin/bash

# Redis Backup Script for EduHub
# This script creates backups of Redis data

set -e

# Configuration
BACKUP_DIR="/var/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7
REDIS_HOST=${REDIS_HOST:-"redis"}
REDIS_PORT=${REDIS_PORT:-6379}
REDIS_PASSWORD=${REDIS_PASSWORD:-""}

# Logging
LOG_FILE="/var/log/redis-backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting Redis backup process"

# Check Redis connectivity
REDIS_CMD="redis-cli -h $REDIS_HOST -p $REDIS_PORT"
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CMD="$REDIS_CMD -a $REDIS_PASSWORD"
fi

if ! $REDIS_CMD ping | grep -q PONG; then
    log "ERROR: Cannot connect to Redis server at $REDIS_HOST:$REDIS_PORT"
    exit 1
fi

log "Connected to Redis successfully"

# Method 1: BGSAVE (Background save)
log "Initiating background save"
if $REDIS_CMD BGSAVE | grep -q "Background saving started"; then
    log "Background save initiated successfully"
    
    # Wait for background save to complete
    while [ "$($REDIS_CMD LASTSAVE)" = "$($REDIS_CMD LASTSAVE)" ]; do
        sleep 2
    done
    
    # Get the RDB file path from Redis config
    RDB_FILENAME=$($REDIS_CMD CONFIG GET dbfilename | tail -n 1)
    RDB_DIR=$($REDIS_CMD CONFIG GET dir | tail -n 1)
    RDB_PATH="$RDB_DIR/$RDB_FILENAME"
    
    # Copy the RDB file to backup directory
    BACKUP_FILE="$BACKUP_DIR/redis_dump_${DATE}.rdb"
    if cp "$RDB_PATH" "$BACKUP_FILE"; then
        log "RDB file copied to: $BACKUP_FILE"
        
        # Compress the backup
        if gzip "$BACKUP_FILE"; then
            COMPRESSED_FILE="${BACKUP_FILE}.gz"
            SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
            log "Backup compressed successfully: $COMPRESSED_FILE (Size: $SIZE)"
        else
            log "ERROR: Failed to compress backup file"
            exit 1
        fi
    else
        log "ERROR: Failed to copy RDB file from $RDB_PATH"
        exit 1
    fi
else
    log "ERROR: Failed to initiate background save"
    exit 1
fi

# Method 2: Export specific data patterns (for analysis)
log "Creating pattern-based backups"

# Export user sessions
SESSIONS_FILE="$BACKUP_DIR/redis_sessions_${DATE}.txt"
$REDIS_CMD --scan --pattern "session:*" | while read -r key; do
    echo "SET $key \"$($REDIS_CMD GET "$key")\"" >> "$SESSIONS_FILE"
done

if [ -s "$SESSIONS_FILE" ]; then
    gzip "$SESSIONS_FILE"
    log "Sessions backup created: ${SESSIONS_FILE}.gz"
else
    rm -f "$SESSIONS_FILE"
    log "No session data found to backup"
fi

# Export cache data
CACHE_FILE="$BACKUP_DIR/redis_cache_${DATE}.txt"
$REDIS_CMD --scan --pattern "cache:*" | while read -r key; do
    TYPE=$($REDIS_CMD TYPE "$key")
    case $TYPE in
        "string")
            echo "SET $key \"$($REDIS_CMD GET "$key")\"" >> "$CACHE_FILE"
            ;;
        "hash")
            $REDIS_CMD HGETALL "$key" | while read -r field; read -r value; do
                echo "HSET $key \"$field\" \"$value\"" >> "$CACHE_FILE"
            done
            ;;
        "list")
            $REDIS_CMD LRANGE "$key" 0 -1 | while read -r value; do
                echo "LPUSH $key \"$value\"" >> "$CACHE_FILE"
            done
            ;;
        "set")
            $REDIS_CMD SMEMBERS "$key" | while read -r member; do
                echo "SADD $key \"$member\"" >> "$CACHE_FILE"
            done
            ;;
    esac
done

if [ -s "$CACHE_FILE" ]; then
    gzip "$CACHE_FILE"
    log "Cache backup created: ${CACHE_FILE}.gz"
else
    rm -f "$CACHE_FILE"
    log "No cache data found to backup"
fi

# Create info snapshot
INFO_FILE="$BACKUP_DIR/redis_info_${DATE}.txt"
{
    echo "# Redis Info Snapshot - $(date)"
    echo "# Server Info"
    $REDIS_CMD INFO server
    echo ""
    echo "# Memory Info"
    $REDIS_CMD INFO memory
    echo ""
    echo "# Stats"
    $REDIS_CMD INFO stats
    echo ""
    echo "# Keyspace"
    $REDIS_CMD INFO keyspace
    echo ""
    echo "# Database Keys Count"
    for db in {0..15}; do
        KEYS_COUNT=$($REDIS_CMD -n $db DBSIZE 2>/dev/null || echo "0")
        if [ "$KEYS_COUNT" -gt 0 ]; then
            echo "Database $db: $KEYS_COUNT keys"
        fi
    done
} > "$INFO_FILE"

gzip "$INFO_FILE"
log "Redis info snapshot created: ${INFO_FILE}.gz"

# Upload to object storage (optional)
if [ "$ENABLE_S3_BACKUP" = "true" ] && command -v aws &> /dev/null; then
    log "Uploading Redis backups to S3/MinIO"
    
    for file in "$BACKUP_DIR"/*_${DATE}.*.gz; do
        if [ -f "$file" ]; then
            FILENAME=$(basename "$file")
            S3_PATH="s3://${BACKUP_BUCKET:-eduhub-backups}/redis/$FILENAME"
            
            if aws s3 cp "$file" "$S3_PATH" --endpoint-url "${S3_ENDPOINT:-}"; then
                log "Successfully uploaded $FILENAME to S3"
            else
                log "WARNING: Failed to upload $FILENAME to S3"
            fi
        fi
    done
fi

# Clean up old backups
log "Cleaning up old Redis backups (keeping last $RETENTION_DAYS days)"

find "$BACKUP_DIR" -name "redis_*" -type f -mtime +$RETENTION_DAYS -exec rm -f {} \; -print | while read -r file; do
    log "Deleted old backup: $(basename "$file")"
done

# Verify backup integrity
log "Verifying backup integrity"
for file in "$BACKUP_DIR"/*_${DATE}.*.gz; do
    if [ -f "$file" ]; then
        if gzip -t "$file"; then
            log "Backup integrity verified: $(basename "$file")"
        else
            log "ERROR: Backup integrity check failed: $(basename "$file")"
            exit 1
        fi
    fi
done

# Get backup statistics
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*_${DATE}.*.gz 2>/dev/null | wc -l || echo "0")
TOTAL_SIZE=$(du -sh "$BACKUP_DIR"/*_${DATE}.*.gz 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
KEY_COUNT=$($REDIS_CMD DBSIZE)

log "Redis backup completed successfully"
log "Backup files created: $BACKUP_COUNT"
log "Total backup size: $TOTAL_SIZE"
log "Total keys backed up: $KEY_COUNT"

# Send notification (optional)
if [ "$BACKUP_NOTIFICATION_WEBHOOK" ]; then
    curl -X POST "$BACKUP_NOTIFICATION_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"✅ Redis backup completed successfully\",
            \"details\": {
                \"timestamp\": \"$(date -Iseconds)\",
                \"backup_files\": $BACKUP_COUNT,
                \"total_size\": \"$TOTAL_SIZE\",
                \"keys_count\": $KEY_COUNT,
                \"retention_days\": $RETENTION_DAYS
            }
        }" || log "WARNING: Failed to send backup notification"
fi

exit 0