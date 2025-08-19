FROM node:20-alpine AS builder

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy root package.json and lockfile
COPY package*.json ./
COPY turbo.json ./
COPY tsconfig.json ./

# Copy shared library
COPY libs/shared ./libs/shared/

# Copy payroll service
COPY services/payroll-service ./services/payroll-service/

# Install dependencies
RUN npm ci

# Build shared library
RUN cd libs/shared && npm run build

# Build payroll service
RUN cd services/payroll-service && npm run build

# Production stage
FROM node:20-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy built application
COPY --from=builder /app/services/payroll-service/dist ./dist
COPY --from=builder /app/services/payroll-service/package*.json ./
COPY --from=builder /app/libs/shared/dist ./node_modules/@eduhub/shared/

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3003/healthz || exit 1

# Start the service
CMD ["node", "dist/main.js"]