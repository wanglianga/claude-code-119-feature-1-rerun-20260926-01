# ---- 构建阶段 1：Vue3 前端 ----
FROM node:22-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 构建阶段 2：NestJS 后端 ----
FROM node:22-alpine AS backend-build
WORKDIR /build/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY backend/ ./
RUN npx nest build

# ---- 运行阶段：非 root 用户 + 健康检查 ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# 官方镜像内置非特权用户 node(uid 1000)
COPY --from=backend-build --chown=node:node /build/backend/node_modules ./node_modules
COPY --from=backend-build --chown=node:node /build/backend/dist ./dist
COPY --from=frontend-build --chown=node:node /build/frontend/dist ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=10 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
