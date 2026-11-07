# 0006. Единый командный слой (`logos-api.js`) и MCP-сервер (`mcp-server.js`)

**Статус:** принято

## Контекст
Ручное копирование промптов и ручной запуск проверок отнимают внимание человека, а прямое редактирование файлов агентами приводит к нарушению структуры проекта.

## Решение
1. Все операции над архитектурой и модулями скелета сведены в единый модуль `logos-api.js` (`status`, `verifyUnit`, `slotBrief`, `checkSlotCandidate`, `simulate`, `scaffoldProject`).
2. Поверх `logos-api.js` работает беззависимостный MCP-сервер `mcp-server.js` (JSON-RPC 2.0 по `stdio`, конфигурация в `.mcp.json`) и консольный интерфейс `cli.js`, а также хуки (`hooks/session-context.sh`, `hooks/pre-commit.sh`) и навык `logos` (`~/.agents/skills/logos` и `~/.claude/skills/logos`).

## Следствия
* И в DeepSeek Harness, и в `claude` CLI (по подписке Max) агент работает с базой `Logos` через одни и те же проверенные команды.
