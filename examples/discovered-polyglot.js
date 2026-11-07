/* Автоматически снятая модель Logos.discoverRepo для «Полиглот» (/mnt/Projects/apps/polyglot) */
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
  "id": "polyglot",
  "title": "Полиглот",
  "summary": "Android-приложение для изучения языков: **иврит**, **английский**, **сербский**.",
  "repo": {
    "root": "/mnt/Projects/apps/polyglot",
    "stack": [
      "Kotlin",
      "Gradle"
    ],
    "requiredFiles": [
      "settings.gradle.kts",
      "build.gradle.kts"
    ],
    "requiredScripts": [],
    "decisionsDir": null
  },
  "terms": [],
  "decisions": [
    {
      "kind": "decision",
      "id": "0001",
      "title": "Слоистая архитектура модулей",
      "status": "accepted",
      "rule": "Зависимости направлены строго сверху вниз по слоям без циклов.",
      "file": null
    }
  ],
  "invariants": [
    {
      "kind": "invariant",
      "id": "INV-ARCH-01",
      "title": "Соблюдение границ слоёв модулей",
      "decision": "0001",
      "why": "Модули нижнего слоя не должны импортировать модули верхних слоёв.",
      "guard": "Logos.verifyRepo (проверка импортов)",
      "scope": [
        "app",
        "core-common",
        "core-model",
        "core-database",
        "core-data",
        "core-designsystem",
        "core-navigation",
        "core-audio",
        "feature-vocabulary",
        "feature-review",
        "feature-settings",
        "feature-reader",
        "feature-reference"
      ],
      "rules": []
    }
  ],
  "modules": [
    {
      "kind": "module",
      "id": "core-common",
      "title": ":core:common",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Gradle-модуль :core:common (2 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.core.common.di",
      "path": "core/common",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "core-model",
      "title": ":core:model",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Gradle-модуль :core:model (23 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.core.model",
      "path": "core/model",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "core-navigation",
      "title": ":core:navigation",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Gradle-модуль :core:navigation (1 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.core.navigation",
      "path": "core/navigation",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "core-audio",
      "title": ":core:audio",
      "layer": 1,
      "layerName": "Уровень 1",
      "role": "Gradle-модуль :core:audio (5 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.core.audio",
      "path": "core/audio",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "core-database",
      "title": ":core:database",
      "layer": 1,
      "layerName": "Уровень 1",
      "role": "Gradle-модуль :core:database (33 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.core.database",
      "path": "core/database",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "core-designsystem",
      "title": ":core:designsystem",
      "layer": 1,
      "layerName": "Уровень 1",
      "role": "Gradle-модуль :core:designsystem (11 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.core.designsystem.component",
      "path": "core/designsystem",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "core-data",
      "title": ":core:data",
      "layer": 2,
      "layerName": "Уровень 2",
      "role": "Gradle-модуль :core:data (17 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.core.data",
      "path": "core/data",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model",
        "core-common",
        "core-database",
        "core-audio"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "feature-reader",
      "title": ":feature:reader",
      "layer": 3,
      "layerName": "Уровень 3",
      "role": "Gradle-модуль :feature:reader (10 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.feature.reader",
      "path": "feature/reader",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model",
        "core-data",
        "core-audio",
        "core-designsystem",
        "core-navigation",
        "core-database"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "feature-reference",
      "title": ":feature:reference",
      "layer": 3,
      "layerName": "Уровень 3",
      "role": "Gradle-модуль :feature:reference (11 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.feature.reference",
      "path": "feature/reference",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model",
        "core-audio",
        "core-data",
        "core-designsystem",
        "core-navigation",
        "core-database"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "feature-review",
      "title": ":feature:review",
      "layer": 3,
      "layerName": "Уровень 3",
      "role": "Gradle-модуль :feature:review (4 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.feature.review.di",
      "path": "feature/review",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model",
        "core-data",
        "core-audio",
        "core-designsystem",
        "core-navigation"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "feature-settings",
      "title": ":feature:settings",
      "layer": 3,
      "layerName": "Уровень 3",
      "role": "Gradle-модуль :feature:settings (7 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.feature.settings",
      "path": "feature/settings",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model",
        "core-data",
        "core-audio",
        "core-designsystem",
        "core-navigation",
        "core-database"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "feature-vocabulary",
      "title": ":feature:vocabulary",
      "layer": 3,
      "layerName": "Уровень 3",
      "role": "Gradle-модуль :feature:vocabulary (8 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.feature.vocabulary.di",
      "path": "feature/vocabulary",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model",
        "core-data",
        "core-designsystem",
        "core-navigation"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "app",
      "title": ":app",
      "layer": 4,
      "layerName": "Уровень 4",
      "role": "Gradle-модуль :app (7 .kt файлов)",
      "pkg": "io.github.alks_sm.polyglot.app",
      "path": "app",
      "files": [
        "build.gradle.kts"
      ],
      "deps": [
        "core-model",
        "core-data",
        "core-designsystem",
        "core-navigation",
        "feature-vocabulary",
        "feature-review",
        "feature-settings",
        "feature-reader",
        "feature-reference"
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
