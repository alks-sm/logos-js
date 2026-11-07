#!/usr/bin/env bash
# Хук импорта контракта Logos в диалог ИИ (SessionStart / UserPromptSubmit).
# Использование:
#   /mnt/Projects/research/Logos/hooks/session-context.sh [модуль]
# Пример в .claude/settings.json:
#   "hooks": { "SessionStart": [{ "hooks": [{ "type": "command", "command": "/mnt/Projects/research/Logos/hooks/session-context.sh" }] }] }

set -euo pipefail
LOGOS_DIR="/mnt/Projects/research/Logos"
node "$LOGOS_DIR/cli.js" hook-context "${1:-}"
