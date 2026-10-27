#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server"
DIAGNOSIS_PYTHON="$SERVER_DIR/.venv-diagnosis/bin/python"
DIAGNOSIS_ARTIFACT="$SERVER_DIR/Models/newmodel.joblib"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required. Install Node.js, then run npm install from the project root." >&2
  exit 1
fi
if ! command -v dotnet >/dev/null 2>&1; then
  echo ".NET SDK is required to run the API." >&2
  exit 1
fi
if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "Frontend dependencies are missing. Run npm install from the project root first." >&2
  exit 1
fi

if [[ ! -x "$DIAGNOSIS_PYTHON" ]]; then
  echo "Diagnosis model environment not found at $DIAGNOSIS_PYTHON." >&2
  echo "Create it with Python 3.11+: cd server && python3.11 -m venv .venv-diagnosis && .venv-diagnosis/bin/pip install -r requirements-diagnosis.txt" >&2
  exit 1
fi
if [[ ! -f "$DIAGNOSIS_ARTIFACT" ]]; then
  echo "Diagnosis model not found at $DIAGNOSIS_ARTIFACT." >&2
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  for port in 3000 4000 8002; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Port $port is already in use. Stop the existing MedTriage service before running npm run program." >&2
      exit 1
    fi
  done
fi

PIDS=()
NAMES=()

cleanup() {
  local pid
  trap - EXIT INT TERM
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in "${PIDS[@]}"; do
    wait "$pid" 2>/dev/null || true
  done
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

(
  cd "$ROOT_DIR"
  exec npm run dev -- --strictPort
) &
PIDS+=("$!")
NAMES+=("Vite frontend")

(
  cd "$SERVER_DIR"
  exec dotnet run --launch-profile http
) &
PIDS+=("$!")
NAMES+=(".NET API")

(
  cd "$SERVER_DIR"
  exec "$DIAGNOSIS_PYTHON" diagnosis_service.py
) &
PIDS+=("$!")
NAMES+=("Diagnosis model service")

echo "Starting MedTriage development stack:"
echo "  Frontend:       http://localhost:3000"
echo "  Admin console:  http://localhost:3000/admin"
echo "  .NET API:       http://localhost:4000"
echo "  Diagnosis:      http://localhost:8002"
echo "Press Ctrl+C to stop all services."

while true; do
  for index in "${!PIDS[@]}"; do
    pid="${PIDS[$index]}"
    if ! kill -0 "$pid" 2>/dev/null; then
      status=0
      set +e
      wait "$pid"
      status=$?
      set -e
      if [[ "$status" -eq 0 ]]; then status=1; fi
      echo "${NAMES[$index]} exited (status $status); stopping the other services." >&2
      exit "$status"
    fi
  done
  sleep 1
done
