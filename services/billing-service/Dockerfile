FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root package files for workspace
COPY package*.json ./
COPY turbo.json ./

# Copy shared library
COPY libs/ ./libs/

# Copy billing service
COPY services/billing-service/ ./services/billing-service/

# Install dependencies
RUN npm ci

# Change to service directory and build
WORKDIR /app/services/billing-service
RUN npm ci
RUN npm run build

# Expose port
EXPOSE 3004

# Start the application
CMD ["npm", "run", "start:prod"]