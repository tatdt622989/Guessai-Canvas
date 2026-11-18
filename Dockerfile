# One container for the whole site: the built frontend, the game API, socket.io and admin.
FROM node:24-alpine AS web
WORKDIR /web
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The frontend calls the API on its own origin
ENV VITE_API_URL=/api
RUN pnpm build

FROM node:24-alpine AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:24-alpine
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/dist \
    UPLOAD_DIR=/data/uploads/img
WORKDIR /app/server
COPY --from=server-deps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=web /web/dist /app/dist
RUN mkdir -p /data/uploads/img && chown -R node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
CMD ["node", "src/server.js"]
