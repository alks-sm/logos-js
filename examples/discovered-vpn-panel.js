/* Автоматически снятая модель Logos.discoverRepo для «vpn-panel» (/mnt/Projects/infra/vpn-panel) */
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
  "id": "vpn-panel",
  "title": "vpn-panel",
  "summary": "Автоматически снятая архитектурная модель репозитория vpn-panel",
  "repo": {
    "root": "/mnt/Projects/infra/vpn-panel",
    "stack": [
      "Go"
    ],
    "requiredFiles": [
      "go.mod"
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
        "cmd-vpnpanel",
        "internal-config",
        "internal-panel",
        "internal-store",
        "internal-xray"
      ],
      "rules": []
    }
  ],
  "modules": [
    {
      "kind": "module",
      "id": "internal-config",
      "title": "internal/config",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Go-пакет internal/config",
      "pkg": "vpnpanel/internal/config",
      "path": "internal/config",
      "files": [],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "internal-store",
      "title": "internal/store",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Go-пакет internal/store",
      "pkg": "vpnpanel/internal/store",
      "path": "internal/store",
      "files": [],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "internal-xray",
      "title": "internal/xray",
      "layer": 0,
      "layerName": "Фундамент (слой 0)",
      "role": "Go-пакет internal/xray",
      "pkg": "vpnpanel/internal/xray",
      "path": "internal/xray",
      "files": [],
      "deps": [],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "internal-panel",
      "title": "internal/panel",
      "layer": 1,
      "layerName": "Уровень 1",
      "role": "Go-пакет internal/panel",
      "pkg": "vpnpanel/internal/panel",
      "path": "internal/panel",
      "files": [],
      "deps": [
        "internal-store",
        "internal-config",
        "internal-xray"
      ],
      "testDeps": [],
      "actorKind": "app"
    },
    {
      "kind": "module",
      "id": "cmd-vpnpanel",
      "title": "cmd/vpnpanel",
      "layer": 2,
      "layerName": "Уровень 2",
      "role": "Go-пакет cmd/vpnpanel",
      "pkg": "vpnpanel/cmd/vpnpanel",
      "path": "cmd/vpnpanel",
      "files": [],
      "deps": [
        "internal-config",
        "internal-panel",
        "internal-store"
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
