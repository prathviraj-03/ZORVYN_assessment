# syntax=docker/dockerfile:1

# Keeping bullseye-slim for OpenSSL 1.1 compatibility.
# If you confirm you're on Prisma 5+ (Node-API engine), you can switch to
# node:20-alpine and drop the apt-get block entirely.
FROM node:20-bullseye-slim

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client at build time — not repeated at container startup
RUN npx prisma generate

EXPOSE 3000

# Default command — overridden per service in docker-compose.yml
CMD ["npm", "run", "dev"]