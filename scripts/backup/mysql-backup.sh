#!/bin/bash

# MySQL Backup Script for EduHub Microservices
# This script creates backups of all service databases

set -e

# Configuration
BACKUP_DIR="/var/backups/mysql"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7
MYSQL_HOST=${DB_MASTER_HOST:-"mysql-master"}
MYSQL_PORT=${DB_MASTER_PORT:-3306}
MYSQL_USER=${DB_USERNAME:-"root"}
MYSQL_PASSWORD=${DB_MASTER_PASSWORD:-"rootpassword"}

# Databases to backup
DATABASES=("user_service" "campus_service" "payroll_service")

# Logging
LOG_FILE="/var/log/mysql-backup.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

log "Starting MySQL backup process"

# Check if MySQL is accessible
if ! mysqladmin ping -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent; then
    log "ERROR: Cannot connect to MySQL server at $MYSQL_HOST:$MYSQL_PORT"
    exit 1
fi

# Create backup for each database
for db in "${DATABASES[@]}"; do
    log "Backing up database: $db"
    
    BACKUP_FILE="$BACKUP_DIR/${db}_${DATE}.sql"
    COMPRESSED_FILE="$BACKUP_FILE.gz"
    
    # Create backup using mysqldump
    if mysqldump \
        -h "$MYSQL_HOST" \
        -P "$MYSQL_PORT" \
        -u "$MYSQL_USER" \
        -p"$MYSQL_PASSWORD" \
        --single-transaction \
        --routines \
        --triggers \
        --events \
        --set-gtid-purged=OFF \
        --default-character-set=utf8mb4 \
        "$db" > "$BACKUP_FILE"; then
        
        # Compress the backup
        if gzip "$BACKUP_FILE"; then
            log "Successfully created compressed backup: $COMPRESSED_FILE"
            
            # Get file size
            SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
            log "Backup size: $SIZE"
        else
            log "ERROR: Failed to compress backup file: $BACKUP_FILE"
            rm -f "$BACKUP_FILE"
            exit 1
        fi
    else
        log "ERROR: Failed to backup database: $db"
        rm -f "$BACKUP_FILE"
        exit 1
    fi
done

# Create a full backup (all databases in one file)
log "Creating full backup of all databases"
FULL_BACKUP_FILE="$BACKUP_DIR/full_backup_${DATE}.sql"
FULL_COMPRESSED_FILE="$FULL_BACKUP_FILE.gz"

if mysqldump \
    -h "$MYSQL_HOST" \
    -P "$MYSQL_PORT" \
    -u "$MYSQL_USER" \
    -p"$MYSQL_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --all-databases \
    --set-gtid-purged=OFF \
    --default-character-set=utf8mb4 > "$FULL_BACKUP_FILE"; then
    
    if gzip "$FULL_BACKUP_FILE"; then
        SIZE=$(du -h "$FULL_COMPRESSED_FILE" | cut -f1)
        log "Successfully created full backup: $FULL_COMPRESSED_FILE (Size: $SIZE)"
    else
        log "ERROR: Failed to compress full backup"
        rm -f "$FULL_BACKUP_FILE"
        exit 1
    fi
else
    log "ERROR: Failed to create full backup"
    exit 1
fi

# Upload to object storage (optional)
if [ "$ENABLE_S3_BACKUP" = "true" ] && command -v aws &> /dev/null; then
    log "Uploading backups to S3/MinIO"
    
    for file in "$BACKUP_DIR"/*_${DATE}.sql.gz; do
        if [ -f "$file" ]; then
            FILENAME=$(basename "$file")
            S3_PATH="s3://${BACKUP_BUCKET:-eduhub-backups}/mysql/$FILENAME"
            
            if aws s3 cp "$file" "$S3_PATH" --endpoint-url "${S3_ENDPOINT:-}"; then
                log "Successfully uploaded $FILENAME to S3"
            else
                log "WARNING: Failed to upload $FILENAME to S3"
            fi
        fi
    done
fi

# Clean up old backups (keep only last N days)
log "Cleaning up old backups (keeping last $RETENTION_DAYS days)"

find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -exec rm -f {} \; -print | while read -r file; do
    log "Deleted old backup: $(basename "$file")"
done

# Verify backup integrity
log "Verifying backup integrity"
for file in "$BACKUP_DIR"/*_${DATE}.sql.gz; do
    if [ -f "$file" ]; then
        if gzip -t "$file"; then
            log "Backup integrity verified: $(basename "$file")"
        else
            log "ERROR: Backup integrity check failed: $(basename "$file")"
            exit 1
        fi
    fi
done

log "MySQL backup process completed successfully"

# Send notification (optional)
if [ "$BACKUP_NOTIFICATION_WEBHOOK" ]; then
    TOTAL_SIZE=$(du -sh "$BACKUP_DIR"/*_${DATE}.sql.gz 2>/dev/null | awk '{sum+=$1} END {print sum}' || echo "0")
    BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/*_${DATE}.sql.gz 2>/dev/null | wc -l || echo "0")
    
    curl -X POST "$BACKUP_NOTIFICATION_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{
            \"text\": \"✅ MySQL backup completed successfully\",
            \"details\": {
                \"timestamp\": \"$(date -Iseconds)\",
                \"databases_backed_up\": $BACKUP_COUNT,
                \"total_size\": \"$TOTAL_SIZE\",
                \"retention_days\": $RETENTION_DAYS
            }
        }" || log "WARNING: Failed to send backup notification"
fi

exit 0