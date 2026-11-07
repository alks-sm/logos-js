#!/usr/bin/env bash
# Хук предкоммитной проверки архитектуры через Logos (для .githooks/pre-commit).
# Блокирует коммит, если нарушена модель Logos или границы модулей/инвариантов в коде.

set -euo pipefail
LOGOS_DIR="/mnt/Projects/research/Logos"
node "$LOGOS_DIR/cli.js" check --strict
