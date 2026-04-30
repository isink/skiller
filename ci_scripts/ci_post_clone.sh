#!/bin/sh
set -euo pipefail

cd "$CI_PRIMARY_REPOSITORY_PATH"

if ! command -v xcodegen >/dev/null 2>&1; then
  brew install xcodegen
fi

xcodegen generate
