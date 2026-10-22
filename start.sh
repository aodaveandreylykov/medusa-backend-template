#!/bin/sh
set -e
node_modules/.bin/medusa db:migrate
node scripts/ensure-admin.js

# Start Medusa in background, seed products, then keep it running
node_modules/.bin/medusa start --port ${PORT:-9000} &
MEDUSA_PID=$!

# Wait for Medusa to be ready
ACTUAL_PORT=${PORT:-9000}
echo "[start] Waiting for Medusa on port $ACTUAL_PORT..."
for i in $(seq 1 90); do
  if wget -q -O /dev/null "http://localhost:$ACTUAL_PORT/health" 2>/dev/null; then
    echo "[start] Medusa is ready (iteration $i)"
    break
  fi
  echo "[start] Not ready yet ($i/90)..."
  sleep 3
done

# Seed products (idempotent)
echo "[start] Running seed-products..."
node scripts/seed-products.js
echo "[start] seed-products done"

# Wait for Medusa process
wait $MEDUSA_PID
