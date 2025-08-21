-- Create separate databases for each microservice
CREATE DATABASE IF NOT EXISTS user_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS campus_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS payroll_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS billing_service CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create a common user with access to all service databases
CREATE USER IF NOT EXISTS 'eduhub_user'@'%' IDENTIFIED BY 'eduhub_password';

GRANT ALL PRIVILEGES ON user_service.* TO 'eduhub_user'@'%';
GRANT ALL PRIVILEGES ON campus_service.* TO 'eduhub_user'@'%';
GRANT ALL PRIVILEGES ON payroll_service.* TO 'eduhub_user'@'%';
GRANT ALL PRIVILEGES ON billing_service.* TO 'eduhub_user'@'%';

-- Create replication user (will be created by environment variables but adding here for completeness)
-- This user will be created by the Docker environment variables automatically
-- CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY 'repl_password';
-- GRANT REPLICATION SLAVE ON *.* TO 'repl_user'@'%';

FLUSH PRIVILEGES;