FROM node:22-slim AS build

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and data
COPY . .

# Build frontend (prebuild copies data files, then tsc + vite build)
RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend, server source, and runtime dependencies
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY src ./src
COPY data ./data

# Copy tsconfig files needed by tsx at runtime
COPY tsconfig.json tsconfig.node.json ./

EXPOSE 4000

CMD ["npm", "start"]
