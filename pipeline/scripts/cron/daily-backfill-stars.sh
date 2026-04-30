#!/bin/bash
# Daily cron wrapper: backfill github_stars for skills.
# Appends logs to logs/backfill-stars.log under the project root.
#
# Install (runs every day at 03:00):
#   crontab -e
#   0 3 * * * /Users/wenhandong/Desktop/Skiller/ios/scripts/cron/daily-backfill-stars.sh

set -euo pipefail

PROJECT_DIR="/Users/wenhandong/Desktop/Skiller/ios"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/backfill-stars.log"

mkdir -p "$LOG_DIR"

# cron has a minimal PATH — expose node/npm installed via Homebrew / /usr/local
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"

cd "$PROJECT_DIR"

{
  echo ""
  echo "===== $(date '+%Y-%m-%d %H:%M:%S') ====="

  # Only proxy if it's reachable — keeps the cron quiet when Clash is off
  if curl -x http://127.0.0.1:7890 -s -o /dev/null -m 3 https://api.github.com/; then
    echo "proxy 7890 reachable → using proxy"
    export https_proxy="http://127.0.0.1:7890"
    export http_proxy="http://127.0.0.1:7890"
  else
    echo "proxy 7890 unreachable → skipping run"
    exit 0
  fi

  npm run backfill:stars
} >> "$LOG_FILE" 2>&1
