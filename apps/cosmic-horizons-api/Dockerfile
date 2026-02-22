# simple multi-stage Dockerfile for API and worker
# build image (pruned dist already contains compiled code)
FROM node:18-alpine AS build
WORKDIR /app
# copy only the pruned package manifest and lock so dependencies can be installed
# copy entire pruned output (includes package.json, lock, workspace_modules, compiled code)
COPY dist .
# install pnpm and production dependencies using the pruned lockfile
RUN npm install -g pnpm@latest && \
    pnpm install --prod

# runtime image for API
FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=build /app .
ENV NODE_ENV=production
CMD ["node", "main.js"]

# worker stage uses same runtime build artifacts but different entrypoint
FROM runtime AS worker
WORKDIR /app
# the compiled code includes worker.ts renamed to worker.js under dist/ path
CMD ["node", "apps/cosmic-horizons-api/src/app/jobs/worker.js"]
