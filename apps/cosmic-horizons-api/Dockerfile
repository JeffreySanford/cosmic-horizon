# simple multi-stage Dockerfile for API and worker
FROM node:18-alpine AS base
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm ci --production
COPY . .
RUN npm run build

# runtime image for API
FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
ENV NODE_ENV=production
CMD ["node", "./dist/main.js"]

# worker stage
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
# the compiled code includes worker.ts renamed to worker.js under dist/
CMD ["node", "./dist/apps/cosmic-horizons-api/src/app/jobs/worker.js"]
