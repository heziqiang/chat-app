ARG NPM_REGISTRY=https://registry.npmjs.org

FROM node:20-alpine AS client-builder
ARG NPM_REGISTRY
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --registry=$NPM_REGISTRY
COPY client/tsconfig.json client/index.html client/vite.config.ts ./
COPY client/src ./src
RUN npm run build

FROM node:20-alpine AS server-builder
ARG NPM_REGISTRY
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --registry=$NPM_REGISTRY
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

FROM node:20-alpine
ARG NPM_REGISTRY
WORKDIR /app
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --registry=$NPM_REGISTRY
COPY --from=server-builder /app/server/dist ./dist
COPY --from=client-builder /app/client/dist ./public
EXPOSE 4000
CMD ["node", "dist/index.js"]
