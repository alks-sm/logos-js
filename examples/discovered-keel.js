/* Автоматически снятая модель Logos.discoverRepo для «Keel» (/mnt/Projects/apps/keel) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Lg = require('../logos.js');
    module.exports = factory(Lg);
  } else {
    root.DiscoveredModel = factory(root.Logos);
  }
})(typeof self !== 'undefined' ? self : this, function (Lg) {
  'use strict';
  const raw = {
  "kind": "project",
  "id": "keel",
  "title": "Keel",
  "summary": "Параметрический механический CAD — замена рабочему процессу конструкторского бюро в Inventor. Деталь — данные (JSON): параметры с выражениями и операции, которые ссылаются друг на ",
  "repo": {
    "root": "/mnt/Projects/apps/keel",
    "stack": [
      "TypeScript",
      "Vitest",
      "Biome",
      "Node.js Workspaces"
    ],
    "requiredFiles": [
      "package.json",
      "tsconfig.json",
      "tsconfig.base.json",
      "biome.json",
      "vitest.config.ts",
      ".githooks/pre-commit"
    ],
    "requiredScripts": [
      "check",
      "test",
      "typecheck",
      "lint",
      "build",
      "smoke"
    ],
    "decisionsDir": "docs/decisions"
  },
  "terms": [],
  "decisions": [
    {
      "kind": "decision",
      "id": "0001",
      "title": "Проблемы Inventor невозможны по построению",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28.",
      "file": "0001-impossible-by-design.md"
    },
    {
      "kind": "decision",
      "id": "0002",
      "title": "Стек",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28; подтверждено итогами этапа 0.",
      "file": "0002-stack.md"
    },
    {
      "kind": "decision",
      "id": "0003",
      "title": "Ссылки только на именованные элементы",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28.",
      "file": "0003-named-elements.md"
    },
    {
      "kind": "decision",
      "id": "0004",
      "title": "Скелет принадлежит сборке",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28; компоновочные эскизы добавлены 2026-10-30.",
      "file": "0004-skeleton-owned-by-assembly.md"
    },
    {
      "kind": "decision",
      "id": "0005",
      "title": "Одно сопряжение на экземпляр и правило порядка",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28; правило порядка 2026-10-30.",
      "file": "0005-one-mate-per-instance.md"
    },
    {
      "kind": "decision",
      "id": "0006",
      "title": "Деталь — функция параметров и входов",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28; исполнения и производные детали 2026-10-30.",
      "file": "0006-part-is-a-function.md"
    },
    {
      "kind": "decision",
      "id": "0007",
      "title": "Хранилище: объекты по хэшу, коммит — снимок сборки",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-29; заменяет хранилище «журнал на деталь» этапа 3, часть 1. Носитель уточнён решением 0035: логика (объекты по хэшу,",
      "file": "0007-store-commits.md"
    },
    {
      "kind": "decision",
      "id": "0008",
      "title": "Номера изделий",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28, уточнено 2026-10-29.",
      "file": "0008-part-numbers.md"
    },
    {
      "kind": "decision",
      "id": "0009",
      "title": "Выпущенное неизменно; изменения — трёх видов",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28, реализовано 2026-10-31 (76573df).",
      "file": "0009-released-changes.md"
    },
    {
      "kind": "decision",
      "id": "0010",
      "title": "Конструкция, метаданные и правила — раздельно",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28.",
      "file": "0010-construction-metadata-rules.md"
    },
    {
      "kind": "decision",
      "id": "0011",
      "title": "Механизм, не политика",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-29.",
      "file": "0011-mechanism-not-policy.md"
    },
    {
      "kind": "decision",
      "id": "0012",
      "title": "Соединения — данные правил; наборы собираются по правилу",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-30 (c800b23).",
      "file": "0012-connections-and-sets.md"
    },
    {
      "kind": "decision",
      "id": "0013",
      "title": "Чертёж — вид модели",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-30; разделение данных и рендера — 2026-10-31.",
      "file": "0013-drawing-is-a-view.md"
    },
    {
      "kind": "decision",
      "id": "0014",
      "title": "Материал",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-30.",
      "file": "0014-material.md"
    },
    {
      "kind": "decision",
      "id": "0015",
      "title": "Отказ остаётся там, где случился",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-28.",
      "file": "0015-failure-stays-local.md"
    },
    {
      "kind": "decision",
      "id": "0016",
      "title": "Решения живут в репозитории",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31.",
      "file": "0016-decisions-in-repo.md"
    },
    {
      "kind": "decision",
      "id": "0017",
      "title": "Уборка не меняет поведения",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31.",
      "file": "0017-cleanup-keeps-behaviour.md"
    },
    {
      "kind": "decision",
      "id": "0018",
      "title": "Ограждение локальное, удалённый CI не заводим",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31.",
      "file": "0018-local-guard-no-remote-ci.md"
    },
    {
      "kind": "decision",
      "id": "0019",
      "title": "Один командный слой, транспорты MCP и IPC",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31; не реализовано.",
      "file": "0019-command-layer-mcp-ipc.md"
    },
    {
      "kind": "decision",
      "id": "0020",
      "title": "Команды слоя `@keel/api`",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31; срез 1 реализован 2026-10-31 (`packages/api`, `packages/mcp`; `drawing.image` через resvg со стилями, вписанными",
      "file": "0020-api-commands.md"
    },
    {
      "kind": "decision",
      "id": "0021",
      "title": "Стенд: срез 2 командного слоя",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31 («Делаем»), шаги 1–4 выполнены 2026-10-31. Уточняет 0019 и 0020.",
      "file": "0021-stand.md"
    },
    {
      "kind": "decision",
      "id": "0022",
      "title": "Вертикальный срез на узле 24537-13",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31 («Делай шаг 6»). Шаг 6 плана из ревью 2026-10-31.",
      "file": "0022-vertical-slice.md"
    },
    {
      "kind": "decision",
      "id": "0023",
      "title": "Экспорт из Inventor: своя надстройка, основа — геометрия STEP",
      "status": "accepted",
      "rule": "Статус: принято 2026-10-31 («делаем своё расширение»); шаги 1–3 сделаны для деталей, сборки и картинка листа — нет.",
      "file": "0023-inventor-export.md"
    },
    {
      "kind": "decision",
      "id": "0024",
      "title": "Инженерные операции по стандартам поверх геометрии",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-01 (направление, пользователь). Реализация отложена до стабилизации ядра (пользователь, 2026-11-01); до тех пор — пл",
      "file": "0024-engineering-features.md"
    },
    {
      "kind": "decision",
      "id": "0025",
      "title": "Стенд ядра на реальных деталях: стабильность — в числах",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-01 (стенд — «Да, начинай»; пороги — «Да, коммит»). Закрыто 2026-11-02 («Закрыть 0025, затем 0024»): пороги достигнут",
      "file": "0025-kernel-stand.md"
    },
    {
      "kind": "decision",
      "id": "0026",
      "title": "Свой решатель эскизов",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-02 (пользователь: «давай отдельной гит-веткой писать свой решатель»; контракт — «Да, начинай»). Сделано в ветке `own",
      "file": "0026-sketch-solver.md"
    },
    {
      "kind": "decision",
      "id": "0027",
      "title": "Знак корня — данные эскиза; построение до счёта",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-02 (пользователь: «Делай всё, для архитектуры и жизни в целом полезно» — о следующих шагах 0026). Ветка `own-sketch-",
      "file": "0027-sketch-roots.md"
    },
    {
      "kind": "decision",
      "id": "0028",
      "title": "Блоки эскиза: контур — функция со своей системой координат",
      "status": "accepted",
      "rule": "Статус: принято направление 2026-11-02 (пользователь: «в рамках одного скетча… блоки, как в Inventor, но геометрия внутри вяжется по центру ",
      "file": "0028-sketch-blocks.md"
    },
    {
      "kind": "decision",
      "id": "0029",
      "title": "Эскиз не вырождается правкой; выродившийся — ошибка на месте",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-02 (пользователь: «если случайно за что-то дёрнул и размер линии ушёл в близкое нулю значение… контуры ломаются и ед",
      "file": "0029-sketch-collapse.md"
    },
    {
      "kind": "decision",
      "id": "0030",
      "title": "Полнота чертежа: полный, по модели, доработка",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-02 (пользователь: «в идеале нужна автоматизация, которая бы позволила отслеживать, что вся геометрия модели определе",
      "file": "0030-drawing-completeness.md"
    },
    {
      "kind": "decision",
      "id": "0031",
      "title": "Покупное изделие: интерфейс поверх файла",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-02 (пользователь: «модель двигателя DOGA нам вполне себе STEP подойдёт, но крепёжка его на той же модели абсолютно н",
      "file": "0031-bought-item-interface.md"
    },
    {
      "kind": "decision",
      "id": "0032",
      "title": "Паз — отверстие с ходом",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-02 (пользователь: «А мы учитываем что есть такая операция как Slot?»; «Да, пиши и делай после»). Реализация — после ",
      "file": "0032-slot.md"
    },
    {
      "kind": "decision",
      "id": "0033",
      "title": "Каноническое положение детали",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-02 (пользователь: «нормализовывать модель относительно центра координат, если это возможно… если это невозможно или ",
      "file": "0033-canonical-pose.md"
    },
    {
      "kind": "decision",
      "id": "0034",
      "title": "Восстановление детали по образцу",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-03 (пользователь: «совместить и распознавание фич, и самообучение, и редактор… восстанавливая деталь по образцу»; «п",
      "file": "0034-recovery-by-sample.md"
    },
    {
      "kind": "decision",
      "id": "0035",
      "title": "Хранилище — реляционная база: данные предприятия и моделирования связаны, тяжёлое — по хэшу вне её",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-03 (пользователь: «мы очень конкретно смотрели в сторону SQL-базы»; «все данные по моделированию и все данные предпр",
      "file": "0035-relational-store.md"
    },
    {
      "kind": "decision",
      "id": "0036",
      "title": "Состояние окна — данные; производное вычисляется; допустимое строится тем же кодом, что исполняет",
      "status": "accepted",
      "rule": "Статус: принято 2026-11-05 (пользователь: «самое главное — единая модель и полностью консистентный интерфейс и поведение… может быть неполно",
      "file": "0036-window-state.md"
    }
  ],
  "invariants": [
    {
      "kind": "invariant",
      "id": "INV-GUARD-01",
      "title": "Ключевые тесты-стражи архитектуры присутствуют в репозитории",
      "decision": "0001",
      "why": "Автоматически обнаруженные охранные тесты при сканировании репозитория.",
      "guard": "packages/api/src/api.test.ts, packages/app/src/renderer/ui/guard.test.ts, packages/app/src/renderer/window-state.test.ts, packages/kernel/src/occt/memory.test.ts, packages/store/src/store.test.ts",
      "scope": [
        "api",
        "app",
        "core",
        "drafting",
        "kernel",
        "mcp",
        "store"
      ],
      "rules": [
        {
          "kind": "file-exists",
          "paths": [
            "packages/api/src/api.test.ts",
            "packages/app/src/renderer/ui/guard.test.ts",
            "packages/app/src/renderer/window-state.test.ts",
            "packages/kernel/src/occt/memory.test.ts",
            "packages/store/src/store.test.ts"
          ],
          "message": "Охранные тесты репозитория на месте"
        }
      ]
    }
  ],
  "modules": [
    {
      "kind": "module",
      "id": "drafting",
      "title": "drafting",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Чертежи по ЕСКД и ISO: SVG-листы с линиями, размерами, допусками и самопроверкой. Источник — библиотека gost.js из Toolbelt.",
      "pkg": "@keel/drafting",
      "path": "packages/drafting",
      "files": [
        "src"
      ],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "kernel",
      "title": "kernel",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Пакет kernel",
      "pkg": "@keel/kernel",
      "path": "packages/kernel",
      "files": [
        "src/occt",
        "src/sketch"
      ],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "core",
      "title": "core",
      "layer": 1,
      "layerName": "Уровень 1",
      "role": "Пакет core",
      "pkg": "@keel/core",
      "path": "packages/core",
      "files": [
        "src/assembly",
        "src/company",
        "src/drawing",
        "src/edit"
      ],
      "deps": [
        "kernel",
        "drafting"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "store",
      "title": "store",
      "layer": 2,
      "layerName": "Уровень 2",
      "role": "Пакет store",
      "pkg": "@keel/store",
      "path": "packages/store",
      "files": [
        "src/sqlite"
      ],
      "deps": [
        "core"
      ],
      "testDeps": [
        "kernel",
        "drafting"
      ],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "api",
      "title": "api",
      "layer": 3,
      "layerName": "Уровень 3",
      "role": "Пакет api",
      "pkg": "@keel/api",
      "path": "packages/api",
      "files": [
        "src"
      ],
      "deps": [
        "core",
        "kernel",
        "drafting",
        "store"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "app",
      "title": "app",
      "layer": 4,
      "layerName": "Уровень 4",
      "role": "Пакет app",
      "pkg": "@keel/app",
      "path": "packages/app",
      "files": [
        "src/main",
        "src/preload",
        "src/renderer",
        "src/web"
      ],
      "deps": [
        "api",
        "core",
        "kernel"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "mcp",
      "title": "mcp",
      "layer": 4,
      "layerName": "Уровень 4",
      "role": "MCP-сервер над @keel/api: команды Keel как инструменты агента, по stdio.",
      "pkg": "@keel/mcp",
      "path": "packages/mcp",
      "files": [
        "src"
      ],
      "deps": [
        "api",
        "core"
      ],
      "testDeps": [],
      "actorKind": "app"
    }
  ],
  "sockets": [],
  "states": [],
  "transitions": [],
  "protocols": [],
  "algorithms": []
};
  return Lg.project({ id: raw.id, title: raw.title, summary: raw.summary }, raw);
});
