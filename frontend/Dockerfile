FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
FROM dependencies AS development
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["npx", "next", "dev", "--hostname", "0.0.0.0"]
FROM development AS builder
RUN npm run build -- --webpack
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
