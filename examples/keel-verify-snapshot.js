/* Автоматический снимок сверки Logos.verifyRepo для браузерного пульта (index.html) */
window.KeelVerifySnapshot = {
  "stats": {
    "rootDir": "/mnt/Projects/apps/keel",
    "timestamp": "2026-11-07T18:53:33.671Z",
    "filesScanned": 308,
    "linesScanned": 59678,
    "importsChecked": 245,
    "packagesVerified": 7,
    "decisionsOnDisk": 36,
    "ruleChecksRun": 8
  },
  "findings": [
    {
      "level": "error",
      "category": "imports",
      "where": "packages/store/src/drawings.test.ts:7",
      "message": "Тест в «store» импортирует «@keel/drafting», который не разрешён ни в deps, ни в testDeps.",
      "moduleId": "store"
    },
    {
      "level": "error",
      "category": "imports",
      "where": "packages/api/src/node.ts:9",
      "message": "Нарушение границы модуля: боевой код «api» (слой 2) импортирует «@keel/drafting» (разрешены только: core, store, kernel).",
      "moduleId": "api"
    },
    {
      "level": "error",
      "category": "imports",
      "where": "packages/api/src/raster.ts:5",
      "message": "Нарушение границы модуля: боевой код «api» (слой 2) импортирует «@keel/drafting» (разрешены только: core, store, kernel).",
      "moduleId": "api"
    },
    {
      "level": "error",
      "category": "imports",
      "where": "packages/api/src/standards.test.ts:3",
      "message": "Тест в «api» импортирует «@keel/drafting», который не разрешён ни в deps, ни в testDeps.",
      "moduleId": "api"
    },
    {
      "level": "warn",
      "category": "package.json",
      "where": "packages/api/package.json",
      "message": "Пакет «@keel/drafting» записан в боевые dependencies «api», хотя в боевом коде не используется (только в тестах — должен быть в devDependencies).",
      "moduleId": "api"
    },
    {
      "level": "warn",
      "category": "package.json",
      "where": "packages/app/package.json",
      "message": "Пакет «@keel/drafting» записан в dependencies «app», но отсутствует в модели Logos (app.deps) и ни разу не импортируется в коде.",
      "moduleId": "app"
    },
    {
      "level": "warn",
      "category": "package.json",
      "where": "packages/app/package.json",
      "message": "Пакет «@keel/store» записан в dependencies «app», но отсутствует в модели Logos (app.deps) и ни разу не импортируется в коде.",
      "moduleId": "app"
    }
  ],
  "checks": [
    {
      "ok": true,
      "category": "stack",
      "where": "package.json",
      "detail": "Скрипты (build, smoke) и стек проверены"
    },
    {
      "ok": true,
      "category": "layout",
      "where": "biome.json",
      "detail": "На месте"
    },
    {
      "ok": true,
      "category": "layout",
      "where": "tsconfig.base.json",
      "detail": "На месте"
    },
    {
      "ok": true,
      "category": "layout",
      "where": "vitest.config.ts",
      "detail": "На месте"
    },
    {
      "ok": true,
      "category": "decisions",
      "where": "docs/decisions",
      "detail": "На диске 36 решений, в базе Logos связаны 9 ключевых"
    },
    {
      "ok": true,
      "category": "modules",
      "where": "kernel (packages/kernel)",
      "detail": "Файлов: 11 (6032 стр.), боевые импорты: [—] ⊆ [—]",
      "moduleId": "kernel"
    },
    {
      "ok": true,
      "category": "modules",
      "where": "drafting (packages/drafting)",
      "detail": "Файлов: 45 (3233 стр.), боевые импорты: [—] ⊆ [—]",
      "moduleId": "drafting"
    },
    {
      "ok": true,
      "category": "modules",
      "where": "core (packages/core)",
      "detail": "Файлов: 108 (22959 стр.), боевые импорты: [kernel, drafting] ⊆ [kernel, drafting]",
      "moduleId": "core"
    },
    {
      "ok": true,
      "category": "modules",
      "where": "store (packages/store)",
      "detail": "Файлов: 35 (5912 стр.), боевые импорты: [core] ⊆ [core, kernel]",
      "moduleId": "store"
    },
    {
      "ok": true,
      "category": "modules",
      "where": "api (packages/api)",
      "detail": "Файлов: 18 (2514 стр.), боевые импорты: [core, kernel, drafting, store] ⊆ [core, store, kernel]",
      "moduleId": "api"
    },
    {
      "ok": true,
      "category": "modules",
      "where": "mcp (packages/mcp)",
      "detail": "Файлов: 3 (309 стр.), боевые импорты: [api, core] ⊆ [api, core]",
      "moduleId": "mcp"
    },
    {
      "ok": true,
      "category": "modules",
      "where": "app (packages/app)",
      "detail": "Файлов: 88 (18719 стр.), боевые импорты: [api, core, kernel] ⊆ [api, core, kernel]",
      "moduleId": "app"
    },
    {
      "ok": true,
      "category": "guard:INV-01",
      "where": "packages/core",
      "detail": "core не должен знать про app, api, store — 0 нарушений (108 файлов)",
      "moduleId": "core",
      "invariantId": "INV-01"
    },
    {
      "ok": true,
      "category": "guard:INV-02",
      "where": "packages/core/src/model/validate.ts",
      "detail": "Геометрический паспорт и тесты восстановления по образцу",
      "moduleId": "kernel",
      "invariantId": "INV-02"
    },
    {
      "ok": true,
      "category": "guard:INV-02",
      "where": "packages/core/src/recognize/pose.test.ts",
      "detail": "Геометрический паспорт и тесты восстановления по образцу",
      "moduleId": "kernel",
      "invariantId": "INV-02"
    },
    {
      "ok": true,
      "category": "guard:INV-03",
      "where": "packages/kernel/src/occt/memory.test.ts",
      "detail": "Тест контроля WASM-кучи OCCT",
      "moduleId": "kernel",
      "invariantId": "INV-03"
    },
    {
      "ok": true,
      "category": "guard:INV-03",
      "where": "packages/kernel/src/occt/index.ts",
      "detail": "Освобождение C++ хэндлов через disposeTool в OCCT-ядре",
      "moduleId": "kernel",
      "invariantId": "INV-03"
    },
    {
      "ok": true,
      "category": "guard:INV-04",
      "where": "packages/store/src/store.test.ts",
      "detail": "Тесты продуктового коммита и хранилища",
      "moduleId": "store",
      "invariantId": "INV-04"
    },
    {
      "ok": true,
      "category": "guard:INV-04",
      "where": "packages/store/src/product.test.ts",
      "detail": "Тесты продуктового коммита и хранилища",
      "moduleId": "store",
      "invariantId": "INV-04"
    },
    {
      "ok": true,
      "category": "guard:INV-05",
      "where": "packages/api/src/api.test.ts",
      "detail": "Тест командного слоя @keel/api",
      "moduleId": "api",
      "invariantId": "INV-05"
    },
    {
      "ok": true,
      "category": "guard:INV-06",
      "where": "packages/app/src/renderer/ui/guard.test.ts",
      "detail": "Охранный тест реестров UI (kit, mech, words)",
      "moduleId": "app",
      "invariantId": "INV-06"
    },
    {
      "ok": true,
      "category": "guard:INV-07",
      "where": "packages/app/src/renderer/window-state.test.ts",
      "detail": "Тест перебора цепочек переходов Nav",
      "moduleId": "app",
      "invariantId": "INV-07"
    }
  ],
  "moduleStats": {
    "kernel": {
      "id": "kernel",
      "files": 11,
      "lines": 6032,
      "prodImports": [],
      "testImports": [],
      "errors": 0,
      "warns": 0,
      "findings": []
    },
    "drafting": {
      "id": "drafting",
      "files": 45,
      "lines": 3233,
      "prodImports": [],
      "testImports": [],
      "errors": 0,
      "warns": 0,
      "findings": []
    },
    "core": {
      "id": "core",
      "files": 108,
      "lines": 22959,
      "prodImports": [
        "kernel",
        "drafting"
      ],
      "testImports": [
        "kernel",
        "drafting"
      ],
      "errors": 0,
      "warns": 0,
      "findings": []
    },
    "store": {
      "id": "store",
      "files": 35,
      "lines": 5912,
      "prodImports": [
        "core"
      ],
      "testImports": [
        "core",
        "kernel",
        "drafting"
      ],
      "errors": 1,
      "warns": 0,
      "findings": [
        {
          "level": "error",
          "category": "imports",
          "where": "packages/store/src/drawings.test.ts:7",
          "message": "Тест в «store» импортирует «@keel/drafting», который не разрешён ни в deps, ни в testDeps.",
          "moduleId": "store"
        }
      ]
    },
    "api": {
      "id": "api",
      "files": 18,
      "lines": 2514,
      "prodImports": [
        "core",
        "kernel",
        "drafting",
        "store"
      ],
      "testImports": [
        "core",
        "kernel",
        "store",
        "drafting"
      ],
      "errors": 3,
      "warns": 1,
      "findings": [
        {
          "level": "error",
          "category": "imports",
          "where": "packages/api/src/node.ts:9",
          "message": "Нарушение границы модуля: боевой код «api» (слой 2) импортирует «@keel/drafting» (разрешены только: core, store, kernel).",
          "moduleId": "api"
        },
        {
          "level": "error",
          "category": "imports",
          "where": "packages/api/src/raster.ts:5",
          "message": "Нарушение границы модуля: боевой код «api» (слой 2) импортирует «@keel/drafting» (разрешены только: core, store, kernel).",
          "moduleId": "api"
        },
        {
          "level": "error",
          "category": "imports",
          "where": "packages/api/src/standards.test.ts:3",
          "message": "Тест в «api» импортирует «@keel/drafting», который не разрешён ни в deps, ни в testDeps.",
          "moduleId": "api"
        },
        {
          "level": "warn",
          "category": "package.json",
          "where": "packages/api/package.json",
          "message": "Пакет «@keel/drafting» записан в боевые dependencies «api», хотя в боевом коде не используется (только в тестах — должен быть в devDependencies).",
          "moduleId": "api"
        }
      ]
    },
    "mcp": {
      "id": "mcp",
      "files": 3,
      "lines": 309,
      "prodImports": [
        "api",
        "core"
      ],
      "testImports": [
        "api",
        "core"
      ],
      "errors": 0,
      "warns": 0,
      "findings": []
    },
    "app": {
      "id": "app",
      "files": 88,
      "lines": 18719,
      "prodImports": [
        "api",
        "core",
        "kernel"
      ],
      "testImports": [
        "core",
        "api",
        "kernel"
      ],
      "errors": 0,
      "warns": 2,
      "findings": [
        {
          "level": "warn",
          "category": "package.json",
          "where": "packages/app/package.json",
          "message": "Пакет «@keel/drafting» записан в dependencies «app», но отсутствует в модели Logos (app.deps) и ни разу не импортируется в коде.",
          "moduleId": "app"
        },
        {
          "level": "warn",
          "category": "package.json",
          "where": "packages/app/package.json",
          "message": "Пакет «@keel/store» записан в dependencies «app», но отсутствует в модели Logos (app.deps) и ни разу не импортируется в коде.",
          "moduleId": "app"
        }
      ]
    }
  },
  "invariantStatus": {
    "INV-01": {
      "id": "INV-01",
      "passed": 1,
      "errors": 0,
      "warns": 0,
      "checks": [
        {
          "ok": true,
          "category": "guard:INV-01",
          "where": "packages/core",
          "detail": "core не должен знать про app, api, store — 0 нарушений (108 файлов)",
          "moduleId": "core",
          "invariantId": "INV-01"
        }
      ],
      "findings": []
    },
    "INV-02": {
      "id": "INV-02",
      "passed": 2,
      "errors": 0,
      "warns": 0,
      "checks": [
        {
          "ok": true,
          "category": "guard:INV-02",
          "where": "packages/core/src/model/validate.ts",
          "detail": "Геометрический паспорт и тесты восстановления по образцу",
          "moduleId": "kernel",
          "invariantId": "INV-02"
        },
        {
          "ok": true,
          "category": "guard:INV-02",
          "where": "packages/core/src/recognize/pose.test.ts",
          "detail": "Геометрический паспорт и тесты восстановления по образцу",
          "moduleId": "kernel",
          "invariantId": "INV-02"
        }
      ],
      "findings": []
    },
    "INV-03": {
      "id": "INV-03",
      "passed": 2,
      "errors": 0,
      "warns": 0,
      "checks": [
        {
          "ok": true,
          "category": "guard:INV-03",
          "where": "packages/kernel/src/occt/memory.test.ts",
          "detail": "Тест контроля WASM-кучи OCCT",
          "moduleId": "kernel",
          "invariantId": "INV-03"
        },
        {
          "ok": true,
          "category": "guard:INV-03",
          "where": "packages/kernel/src/occt/index.ts",
          "detail": "Освобождение C++ хэндлов через disposeTool в OCCT-ядре",
          "moduleId": "kernel",
          "invariantId": "INV-03"
        }
      ],
      "findings": []
    },
    "INV-04": {
      "id": "INV-04",
      "passed": 2,
      "errors": 0,
      "warns": 0,
      "checks": [
        {
          "ok": true,
          "category": "guard:INV-04",
          "where": "packages/store/src/store.test.ts",
          "detail": "Тесты продуктового коммита и хранилища",
          "moduleId": "store",
          "invariantId": "INV-04"
        },
        {
          "ok": true,
          "category": "guard:INV-04",
          "where": "packages/store/src/product.test.ts",
          "detail": "Тесты продуктового коммита и хранилища",
          "moduleId": "store",
          "invariantId": "INV-04"
        }
      ],
      "findings": []
    },
    "INV-05": {
      "id": "INV-05",
      "passed": 1,
      "errors": 0,
      "warns": 0,
      "checks": [
        {
          "ok": true,
          "category": "guard:INV-05",
          "where": "packages/api/src/api.test.ts",
          "detail": "Тест командного слоя @keel/api",
          "moduleId": "api",
          "invariantId": "INV-05"
        }
      ],
      "findings": []
    },
    "INV-06": {
      "id": "INV-06",
      "passed": 1,
      "errors": 0,
      "warns": 0,
      "checks": [
        {
          "ok": true,
          "category": "guard:INV-06",
          "where": "packages/app/src/renderer/ui/guard.test.ts",
          "detail": "Охранный тест реестров UI (kit, mech, words)",
          "moduleId": "app",
          "invariantId": "INV-06"
        }
      ],
      "findings": []
    },
    "INV-07": {
      "id": "INV-07",
      "passed": 1,
      "errors": 0,
      "warns": 0,
      "checks": [
        {
          "ok": true,
          "category": "guard:INV-07",
          "where": "packages/app/src/renderer/window-state.test.ts",
          "detail": "Тест перебора цепочек переходов Nav",
          "moduleId": "app",
          "invariantId": "INV-07"
        }
      ],
      "findings": []
    },
    "INV-08": {
      "id": "INV-08",
      "passed": 0,
      "errors": 0,
      "warns": 0,
      "checks": [],
      "findings": []
    }
  }
};
