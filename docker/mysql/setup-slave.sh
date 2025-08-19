#!/bin/bash

# Wait for the slave MySQL to be ready
echo "Waiting for slave MySQL to be ready..."
until mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1" >/dev/null 2>&1; do
  echo "Waiting for MySQL slave to start..."
  sleep 2
done

# Wait for master to be available
echo "Waiting for master MySQL to be available..."
until nc -z -v -w30 $MYSQL_MASTER_HOST 3306; do
  echo "Waiting for master MySQL connection..."
  sleep 5
done

# Additional wait to ensure master is fully initialized
sleep 10

echo "Setting up slave replication..."

# Create replication user on slave (this is actually done on master, but we'll handle it here)
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -h $MYSQL_MASTER_HOST <<-EOSQL
    CREATE USER IF NOT EXISTS '$MYSQL_REPLICATION_USER'@'%' IDENTIFIED WITH mysql_native_password BY '$MYSQL_REPLICATION_PASSWORD';
    GRANT REPLICATION SLAVE ON *.* TO '$MYSQL_REPLICATION_USER'@'%';
    FLUSH PRIVILEGES;
EOSQL

# Get master status for GTID-based replication
echo "Configuring slave with GTID-based replication..."

# Reset slave if it was configured before
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
    STOP SLAVE;
    RESET SLAVE ALL;
EOSQL

# Configure slave to connect to master using GTID
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
    CHANGE MASTER TO
        MASTER_HOST='$MYSQL_MASTER_HOST',
        MASTER_PORT=3306,
        MASTER_USER='$MYSQL_REPLICATION_USER',
        MASTER_PASSWORD='$MYSQL_REPLICATION_PASSWORD',
        MASTER_AUTO_POSITION=1;
EOSQL

# Start slave
mysql -u root -p"$MYSQL_ROOT_PASSWORD" <<-EOSQL
    START SLAVE;
EOSQL

# Wait a moment and check slave status
sleep 5

# Check slave status
echo "Checking slave status..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW SLAVE STATUS\G"

# Verify replication is working
SLAVE_IO_RUNNING=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW SLAVE STATUS\G" | grep "Slave_IO_Running:" | awk '{print $2}')
SLAVE_SQL_RUNNING=$(mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW SLAVE STATUS\G" | grep "Slave_SQL_Running:" | awk '{print $2}')

if [ "$SLAVE_IO_RUNNING" = "Yes" ] && [ "$SLAVE_SQL_RUNNING" = "Yes" ]; then
    echo "✅ Slave replication is running successfully!"
else
    echo "❌ Slave replication setup failed!"
    echo "IO Running: $SLAVE_IO_RUNNING, SQL Running: $SLAVE_SQL_RUNNING"
    mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW SLAVE STATUS\G" | grep -E "(Last_IO_Error|Last_SQL_Error):"
fi

echo "Slave setup complete."