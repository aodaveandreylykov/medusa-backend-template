FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN NODE_OPTIONS="--max-old-space-size=4096" npm run build

# ─── Runtime ────────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/.medusa/server ./
COPY start.sh ./
COPY scripts/ ./scripts/
RUN chmod +x start.sh && npm install --omit=dev --legacy-peer-deps

ENV NODE_ENV=production

EXPOSE 9000

CMD ["./start.sh"]
