---
name: logos
description: Формальная база архитектуры, инвариантов, границ модулей, разъёмов плагинов, состояний и схем (ДРАКОН + Дорожки) в /mnt/Projects/research/Logos. Использовать при проверке архитектуры Keel, кристаллизации кода, проектировании плагинов, разрешении споров между моделями («я так не думаю») и генерации жёсткого ТЗ-контракта для агентов.
---

# Logos — фреймворк кристаллизации архитектуры

Каталог: `/mnt/Projects/research/Logos` (`~/Projects/research/Logos`).
Назначение: заменить расплывчатую прозу в `.md`-файлах исполняемой моделью архитектуры (`logos.js` + `examples/keel-model.js`), которая автоматически сверяется с живым кодом репозитория (`Logos.verifyRepo`) и рисует интерактивные схемы в браузере (`index.html`).

## Команды для работы в диалоге

```bash
# 1. Полная проверка модели (lint) и живого репозитория Keel (verifyRepo) + обновление снимка для UI:
node /mnt/Projects/research/Logos/cli.js check

# 2. Выгрузить компактную «прошивку» (ТЗ-контракт) для ИИ по всей системе или конкретному модулю:
node /mnt/Projects/research/Logos/cli.js brief
node /mnt/Projects/research/Logos/cli.js brief core
node /mnt/Projects/research/Logos/cli.js brief app

# 3. Выгрузить безапелляционный вердикт по найденным расхождениям кода с моделью (для пресечения споров):
node /mnt/Projects/research/Logos/cli.js judge
node /mnt/Projects/research/Logos/cli.js judge api

# 4. Вывести блок <logos-architecture-contract> (то, что отдаёт хук диалога):
/mnt/Projects/research/Logos/hooks/session-context.sh [модуль]
```

## Подключение хуков в Claude Code / Git

1. **Импорт контекста в сессию (`.claude/settings.local.json` или `.claude/settings.json`):**
   ```json
   {
     "hooks": {
       "SessionStart": [
         {
           "hooks": [
             {
               "type": "command",
               "command": "/mnt/Projects/research/Logos/hooks/session-context.sh"
             }
           ]
         }
       ]
     }
   }
   ```
2. **Ограждение коммита (`.githooks/pre-commit`):**
   ```sh
   /mnt/Projects/research/Logos/hooks/pre-commit.sh
   ```

## Пять осей модели Logos

1. **Законы (`decisions`, `invariants`, `terms`)**: каждое архитектурное решение связано с инвариантами, а каждый инвариант обязан иметь исполняемые правила (`rules`: `file-exists`, `forbid-regex`, `require-regex`), проверяемые на диске.
2. **Слои, модули и файловая структура (`modules`)**: зависимости текут строго сверху вниз (`layer 3 → 2 → 1 → 0`); `verifyRepo` сканирует все исходники `.ts`/`.js` и `package.json`, ловя незаконные межмодульные импорты и мёртвые зависимости.
3. **Разъёмы под плагины (`sockets`)**: явные точки расширения (`socket:feature`, `socket:assembly-gen`, `socket:company-rules`, `socket:ui-tool`) с входным контрактом и списком охраняемых инвариантов.
4. **Автомат состояний (`states`, `transitions`)**: проверка достижимости от начального состояния, отсутствия тупиков и обязательного возврата по `Esc`.
5. **Поведение (`protocols` на `lanes-js`, `algorithms` на `drakon-js`)**: схемы дорожек и блок-схемы ДРАКОН со сквозной проверкой вставок `D.ins`.
