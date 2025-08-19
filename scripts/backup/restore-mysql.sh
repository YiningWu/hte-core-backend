#!/bin/bash

# MySQL Restore Script for EduHub
# This script restores MySQL databases from backups

set -e

# Configuration
BACKUP_DIR="/var/backups/mysql"
MYSQL_HOST=${DB_MASTER_HOST:-"mysql-master"}
MYSQL_PORT=${DB_MASTER_PORT:-3306}
MYSQL_USER=${DB_USERNAME:-"root"}
MYSQL_PASSWORD=${DB_MASTER_PASSWORD:-"rootpassword"}

# Logging
LOG_FILE="/var/log/mysql-restore.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Usage function
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -d, --date DATE          Restore from backups of specific date (YYYYMMDD_HHMMSS)"
    echo "  -f, --file FILE          Restore from specific backup file"
    echo "  -b, --database DB        Restore specific database only"
    echo "  -l, --list              List available backups"
    echo "  -y, --yes               Skip confirmation prompts"
    echo "  -t, --test              Test restore (dry run)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --list                                    # List available backups"
    echo "  $0 --date 20231201_140000                   # Restore all databases from specific backup"
    echo "  $0 --file user_service_20231201_140000.sql.gz --database user_service"
    echo "  $0 --database user_service --date 20231201_140000"
}

# Parse command line arguments
BACKUP_DATE=""
BACKUP_FILE=""
TARGET_DATABASE=""
LIST_BACKUPS=false
SKIP_CONFIRMATION=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--date)
            BACKUP_DATE="$2"
            shift 2
            ;;
        -f|--file)
            BACKUP_FILE="$2"
            shift 2
            ;;
        -b|--database)
            TARGET_DATABASE="$2"
            shift 2
            ;;
        -l|--list)
            LIST_BACKUPS=true
            shift
            ;;
        -y|--yes)
            SKIP_CONFIRMATION=true
            shift
            ;;
        -t|--test)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# List backups function
list_backups() {
    echo "Available MySQL backups:"
    echo "========================"
    
    if [ ! -d "$BACKUP_DIR" ] || [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "No backups found in $BACKUP_DIR"
        return
    fi
    
    echo "Full Backups:"
    ls -la "$BACKUP_DIR"/full_backup_*.sql.gz 2>/dev/null | while read -r line; do
        file=$(echo "$line" | awk '{print $9}')
        if [ -n "$file" ]; then
            basename_file=$(basename "$file")
            date_part=$(echo "$basename_file" | grep -o '[0-9]\{8\}_[0-9]\{6\}')
            size=$(echo "$line" | awk '{print $5}')
            date_formatted=$(date -d "${date_part:0:8} ${date_part:9:2}:${date_part:11:2}:${date_part:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Invalid date")
            printf "  %-40s %10s %s\n" "$basename_file" "$size" "$date_formatted"
        fi
    done
    
    echo ""
    echo "Individual Database Backups:"
    for db in user_service campus_service payroll_service; do
        echo "  $db:"
        ls -la "$BACKUP_DIR"/${db}_*.sql.gz 2>/dev/null | while read -r line; do
            file=$(echo "$line" | awk '{print $9}')
            if [ -n "$file" ]; then
                basename_file=$(basename "$file")
                date_part=$(echo "$basename_file" | grep -o '[0-9]\{8\}_[0-9]\{6\}')
                size=$(echo "$line" | awk '{print $5}')
                date_formatted=$(date -d "${date_part:0:8} ${date_part:9:2}:${date_part:11:2}:${date_part:13:2}" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "Invalid date")
                printf "    %-40s %10s %s\n" "$basename_file" "$size" "$date_formatted"
            fi
        done
    done
}

# If list option is specified, show backups and exit
if [ "$LIST_BACKUPS" = true ]; then
    list_backups
    exit 0
fi

# Validate arguments
if [ -z "$BACKUP_DATE" ] && [ -z "$BACKUP_FILE" ]; then
    echo "Error: Either --date or --file must be specified"
    usage
    exit 1
fi

log "Starting MySQL restore process"

# Check MySQL connectivity
if ! mysqladmin ping -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" --silent; then
    log "ERROR: Cannot connect to MySQL server at $MYSQL_HOST:$MYSQL_PORT"
    exit 1
fi

log "Connected to MySQL successfully"

# Function to restore from file
restore_from_file() {
    local backup_file="$1"
    local database="$2"
    
    if [ ! -f "$backup_file" ]; then
        log "ERROR: Backup file not found: $backup_file"
        return 1
    fi
    
    log "Restoring from file: $backup_file"
    
    if [ "$DRY_RUN" = true ]; then
        log "DRY RUN: Would restore $backup_file to database $database"
        return 0
    fi
    
    # Create database if it doesn't exist
    if [ -n "$database" ]; then
        log "Creating database if not exists: $database"
        mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
            -e "CREATE DATABASE IF NOT EXISTS $database CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    fi
    
    # Restore the backup
    if [[ "$backup_file" == *.gz ]]; then
        log "Decompressing and restoring backup..."
        if [ -n "$database" ]; then
            gunzip -c "$backup_file" | mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$database"
        else
            gunzip -c "$backup_file" | mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD"
        fi
    else
        log "Restoring uncompressed backup..."
        if [ -n "$database" ]; then
            mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" "$database" < "$backup_file"
        else
            mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" < "$backup_file"
        fi
    fi
    
    log "✅ Successfully restored $backup_file"
}

# Main restore logic
if [ -n "$BACKUP_FILE" ]; then
    # Restore from specific file
    FULL_PATH="$BACKUP_DIR/$BACKUP_FILE"
    if [ ! -f "$FULL_PATH" ]; then
        FULL_PATH="$BACKUP_FILE"  # Use as absolute path
    fi
    
    if [ "$SKIP_CONFIRMATION" = false ] && [ "$DRY_RUN" = false ]; then
        echo "WARNING: This will restore data from backup file: $FULL_PATH"
        if [ -n "$TARGET_DATABASE" ]; then
            echo "Target database: $TARGET_DATABASE"
        else
            echo "This is a FULL restore and will affect ALL databases"
        fi
        echo "This operation may overwrite existing data!"
        read -p "Are you sure you want to continue? (y/N): " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Restore cancelled by user"
            exit 0
        fi
    fi
    
    restore_from_file "$FULL_PATH" "$TARGET_DATABASE"

elif [ -n "$BACKUP_DATE" ]; then
    # Restore from date
    if [ -n "$TARGET_DATABASE" ]; then
        # Restore specific database
        BACKUP_FILE="$BACKUP_DIR/${TARGET_DATABASE}_${BACKUP_DATE}.sql.gz"
        
        if [ ! -f "$BACKUP_FILE" ]; then
            log "ERROR: Backup file not found: $BACKUP_FILE"
            log "Available backups for $TARGET_DATABASE:"
            ls -la "$BACKUP_DIR"/${TARGET_DATABASE}_*.sql.gz 2>/dev/null || log "No backups found"
            exit 1
        fi
        
        if [ "$SKIP_CONFIRMATION" = false ] && [ "$DRY_RUN" = false ]; then
            echo "WARNING: This will restore database '$TARGET_DATABASE' from backup: $BACKUP_DATE"
            echo "This operation may overwrite existing data!"
            read -p "Are you sure you want to continue? (y/N): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Restore cancelled by user"
                exit 0
            fi
        fi
        
        restore_from_file "$BACKUP_FILE" "$TARGET_DATABASE"
    else
        # Restore all databases from date
        DATABASES=("user_service" "campus_service" "payroll_service")
        
        if [ "$SKIP_CONFIRMATION" = false ] && [ "$DRY_RUN" = false ]; then
            echo "WARNING: This will restore ALL databases from backup: $BACKUP_DATE"
            echo "Databases to restore: ${DATABASES[*]}"
            echo "This operation may overwrite existing data!"
            read -p "Are you sure you want to continue? (y/N): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log "Restore cancelled by user"
                exit 0
            fi
        fi
        
        for db in "${DATABASES[@]}"; do
            BACKUP_FILE="$BACKUP_DIR/${db}_${BACKUP_DATE}.sql.gz"
            
            if [ -f "$BACKUP_FILE" ]; then
                restore_from_file "$BACKUP_FILE" "$db"
            else
                log "WARNING: Backup file not found for $db: $BACKUP_FILE"
            fi
        done
    fi
fi

# Verify restore
if [ "$DRY_RUN" = false ]; then
    log "Verifying restore..."
    
    if [ -n "$TARGET_DATABASE" ]; then
        # Verify specific database
        TABLE_COUNT=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
            -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$TARGET_DATABASE';" -sN)
        log "Database $TARGET_DATABASE has $TABLE_COUNT tables"
    else
        # Verify all databases
        for db in user_service campus_service payroll_service; do
            if mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
                -e "USE $db; SELECT 1;" >/dev/null 2>&1; then
                TABLE_COUNT=$(mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" -p"$MYSQL_PASSWORD" \
                    -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$db';" -sN)
                log "✅ Database $db restored successfully ($TABLE_COUNT tables)"
            else
                log "❌ Database $db verification failed"
            fi
        done
    fi
fi

log "✅ MySQL restore process completed"

exit 0