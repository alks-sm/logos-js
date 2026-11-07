/* 3-contracts.js — Паспорта всех колбэков скелета с встроенными проверочными тест-кейсами (cases).
   Каждый колбэк обязан пройти свои тесты на замороженных данных (deepFreeze) до запуска системы. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NavContracts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return [
    /* ── Чистые предикаты и селекторы (guards) для вопросов D.q и D.choice ── */
    {
      id: 'isRevFresh',
      kind: 'guard',
      title: 'Проверка актуальности ревизии геометрии (modelRev === state.rev)',
      reads: ['state.rev', 'bag.action.modelRev'],
      cases: [
        {
          title: 'совпадающая ревизия проходит',
          state: { rev: 3 },
          bag: { action: { type: 'pick-edge', modelRev: 3 } },
          expect: true,
        },
        {
          title: 'устаревшая ревизия отклоняется',
          state: { rev: 5 },
          bag: { action: { type: 'pick-edge', modelRev: 4 } },
          expect: false,
        },
      ],
    },
    {
      id: 'actionCategory',
      kind: 'guard',
      title: 'Классификация входного действия на open / tab / pick',
      reads: ['bag.action.type'],
      cases: [
        { title: 'действие open', bag: { action: { type: 'open' } }, expect: 'open' },
        { title: 'действие tab', bag: { action: { type: 'tab' } }, expect: 'tab' },
        { title: 'действие pick-edge идёт в ветку pick', bag: { action: { type: 'pick-edge' } }, expect: 'pick' },
      ],
    },
    {
      id: 'canSwitchTab',
      kind: 'guard',
      title: 'Допустима ли целевая вкладка (whyNotDrawing === null)',
      reads: ['state.open', 'bag.action.tab', 'world.drawings'],
      cases: [
        {
          title: 'вкладка drawing разрешена для детали проекта с чертежом',
          state: { open: { kind: 'part', path: 'parts/shaft' } },
          bag: { action: { type: 'tab', tab: 'drawing' } },
          world: { drawings: ['parts/shaft'] },
          expect: true,
        },
        {
          title: 'вкладка drawing запрещена для сборки',
          state: { open: { kind: 'assembly', path: '' } },
          bag: { action: { type: 'tab', tab: 'drawing' } },
          world: { drawings: ['parts/shaft'] },
          expect: false,
        },
      ],
    },
    {
      id: 'isPartModelOpen',
      kind: 'guard',
      title: 'Открыта ли деталь на вкладке 3D-модели',
      reads: ['state.open.kind', 'state.tab'],
      cases: [
        {
          title: 'деталь на вкладке model — да',
          state: { open: { kind: 'part', path: 'p1' }, tab: 'model' },
          expect: true,
        },
        {
          title: 'сборка — нет',
          state: { open: { kind: 'assembly', path: '' }, tab: 'model' },
          expect: false,
        },
      ],
    },

    /* ── Чистые преобразования состояния и контекста (steps) для D.act ── */
    {
      id: 'capturePrev',
      kind: 'step',
      title: 'Сохранить исходный снимок состояния в bag.prev для вычисления диффа',
      writes: ['bag.prev'],
      cases: [
        {
          title: 'записывает state в bag.prev',
          state: { tab: 'model', rev: 1 },
          bag: {},
          check: (res) => res && res.bag && res.bag.prev && res.bag.prev.rev === 1,
        },
      ],
    },
    {
      id: 'applyOpen',
      kind: 'step',
      title: 'Открыть деталь или сборку со сбросом вкладки в model и увеличением rev',
      writes: ['state.open', 'state.tab', 'state.rev'],
      cases: [
        {
          title: 'открытие сборки сбрасывает tab в model и увеличивает rev',
          state: { open: { kind: 'part', path: 'p1' }, tab: 'drawing', rev: 2, shown: { sketches: true, skeleton: true } },
          bag: { action: { type: 'open', open: { kind: 'assembly', path: 'sub' } } },
          check: (res) => res.state.open.kind === 'assembly' && res.state.tab === 'model' && res.state.rev === 3,
        },
      ],
    },
    {
      id: 'applyTab',
      kind: 'step',
      title: 'Установить новую вкладку в состоянии окна',
      writes: ['state.tab'],
      cases: [
        {
          title: 'переключает tab в drawing',
          state: { open: { kind: 'part', path: 'p1' }, tab: 'model', rev: 1 },
          bag: { action: { type: 'tab', tab: 'drawing' } },
          check: (res) => res.state.tab === 'drawing',
        },
      ],
    },
    {
      id: 'recordTabRefusal',
      kind: 'step',
      title: 'Вычислить и записать точную причину отказа вкладки в bag.refusal',
      writes: ['bag.refusal'],
      cases: [
        {
          title: 'объясняет отказ для сборки',
          state: { open: { kind: 'assembly', path: '' }, tab: 'model', rev: 1 },
          bag: { action: { type: 'tab', tab: 'drawing' } },
          world: { drawings: [] },
          check: (res) => res.bag && res.bag.refusal && res.bag.refusal.includes('сборки'),
        },
      ],
    },
    {
      id: 'applyPick',
      kind: 'step',
      title: 'Обновить выбранные рёбра/грань/операцию внутри открытой детали',
      writes: ['state.open.pick'],
      cases: [
        {
          title: 'выбирает ребро 14 и сбрасывает грань',
          state: { open: { kind: 'part', path: 'p1', pick: { feature: 'f1', face: 3, edges: [] } }, tab: 'model', rev: 1 },
          bag: { action: { type: 'pick-edge', edge: 14, add: false } },
          check: (res) => res.state.open.pick.edges[0] === 14 && res.state.open.pick.face === null,
        },
      ],
    },
    {
      id: 'computeEffects',
      kind: 'step',
      title: 'Вычислить производный mode и список изменившихся зон окна (changedPanels)',
      writes: ['bag.derivedMode', 'bag.changedPanels'],
      cases: [
        {
          title: 'при смене вкладки помечает зону tab и вычисляет mode=drawing',
          state: { open: { kind: 'part', path: 'p1', pick: { edges: [] } }, tab: 'drawing', rev: 1 },
          bag: { prev: { open: { kind: 'part', path: 'p1', pick: { edges: [] } }, tab: 'model', rev: 1 } },
          check: (res) => res.bag.derivedMode === 'drawing' && res.bag.changedPanels.includes('tab'),
        },
      ],
    },

    /* ── Внешние порты (ports) для полок D.shelf ── */
    {
      id: 'refuseStale',
      kind: 'port',
      port: 'ui',
      title: 'Сообщить об отсечении устаревшего действия',
      cases: [
        {
          title: 'формирует сообщение о гонке ревизий',
          state: { rev: 5 },
          bag: { action: { modelRev: 4 } },
          check: (res) => typeof res === 'string' && res.includes('rev 4 ≠ 5'),
        },
      ],
    },
    {
      id: 'refuseTab',
      kind: 'port',
      port: 'ui',
      title: 'Показать пользователю причину недоступности вкладки',
      cases: [
        {
          title: 'возвращает текст отказа из bag.refusal',
          state: {},
          bag: { refusal: 'В режиме сборки чертёж недоступен' },
          expect: 'Отказ: В режиме сборки чертёж недоступен',
        },
      ],
    },
    {
      id: 'refusePick',
      kind: 'port',
      port: 'ui',
      title: 'Отклонить выбор ребра вне 3D-модели детали',
      cases: [
        {
          title: 'возвращает предупреждение',
          state: {},
          bag: {},
          expect: 'Отказ: выбор геометрии возможен только на 3D-модели детали',
        },
      ],
    },
    {
      id: 'renderDiff',
      kind: 'port',
      port: 'ui',
      title: 'Перерисовать только изменившиеся панели окна',
      cases: [
        {
          title: 'перечисляет обновлённые панели и вычисленный режим',
          state: {},
          bag: { derivedMode: 'drawing', changedPanels: ['tab'] },
          expect: 'render(mode="drawing", panels=[tab])',
        },
      ],
    },
    {
      id: 'requestBuild',
      kind: 'port',
      port: 'api',
      title: 'Отправить в @keel/api запрос построения с ключом текущей ревизии',
      cases: [
        {
          title: 'формирует команду сборки с rev',
          state: { open: { kind: 'assembly', path: 'sub/drive' }, rev: 4 },
          bag: {},
          expect: 'api.call("assembly.evaluate", { path: "sub/drive", rev: 4 })',
        },
      ],
    },
  ];
});
