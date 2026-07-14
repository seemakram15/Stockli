#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3001}"
NODE_VERSION="$(tr -d '[:space:]' < "$ROOT_DIR/.nvmrc")"
LOG_DIR="$ROOT_DIR/.omx/logs"
LOG_FILE="$LOG_DIR/dev-server.log"

mkdir -p "$LOG_DIR"

# npm can inject prefix variables into child scripts. nvm rejects that setup,
# so clear them before loading nvm or switching Node versions.
unset npm_config_prefix
unset NPM_CONFIG_PREFIX
unset PREFIX

load_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    return 0
  fi

  if [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "/opt/homebrew/opt/nvm/nvm.sh"
    return 0
  fi

  return 1
}

if ! load_nvm; then
  echo "nvm is required but could not be loaded. Install nvm first." >&2
  exit 1
fi

nvm use "$NODE_VERSION" >/dev/null 2>&1 || nvm install "$NODE_VERSION" >/dev/null
nvm use "$NODE_VERSION" >/dev/null

if lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Stopping existing Stockli process on port $PORT..."
  lsof -tiTCP:"$PORT" -sTCP:LISTEN | xargs kill -9
  sleep 1
fi

echo "Using Node $(node -v)"

if [ "${DETACH:-0}" = "1" ]; then
  nohup env PORT="$PORT" "$ROOT_DIR/node_modules/.bin/next" dev --turbopack \
    >"$LOG_FILE" 2>&1 </dev/null &
  SERVER_PID=$!
  disown "$SERVER_PID" 2>/dev/null || true

  for _ in {1..60}; do
    if curl -s -o /dev/null "http://localhost:$PORT"; then
      echo "Stockli restarted on http://localhost:$PORT"
      echo "PID: $SERVER_PID"
      echo "Logs: $LOG_FILE"
      exit 0
    fi
    sleep 1
  done

  echo "Server did not become ready in time. Check $LOG_FILE" >&2
  exit 1
fi

echo "Starting Stockli on http://localhost:$PORT ..."
exec env PORT="$PORT" npm run dev
