/* 1-schema.js — Описание данных и вычисляемых проекций модуля навигации окна (Решение 0036).
   Правило: ни одно поле, которое можно вычислить (mode, whyNotTab), не хранится в State! */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NavSchema = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const initialState = {
    open: {
      kind: 'part',
      path: 'parts/shaft',
      pick: { feature: null, face: null, edges: [] },
    },
    shown: { sketches: true, skeleton: true },
    tab: 'model',
    rev: 1,
  };

  const fields = [
    { name: 'open', type: "{ kind: 'part' | 'assembly', path: string | null, pick: { feature, face, edges[] } }", desc: 'Что открыто в окне и что выбрано внутри детали' },
    { name: 'shown', type: '{ sketches: boolean, skeleton: boolean }', desc: 'Видимость вспомогательной геометрии на сцене' },
    { name: 'tab', type: "'model' | 'drawing'", desc: 'Текущая вкладка представления (чертёж допустим только у детали проекта с листом)' },
    { name: 'rev', type: 'number', desc: 'Монотонный счётчик открытий/перестроений для отсечения устаревших ответов ядра' },
  ];

  // Вычисляемые проекции (Derived) — никогда не записываются в State!
  const derived = {
    modeOf: (state) => (state.tab === 'drawing' ? 'drawing' : state.open.kind),
    whyNotDrawing: (state, world) => {
      if (state.open.kind === 'assembly') return 'В режиме сборки вкладка чертежа детали недоступна';
      if (!state.open.path) return 'У детали-примера вне проекта нет чертежа в хранилище';
      if (!world || !world.drawings || !world.drawings.includes(state.open.path)) {
        return `У детали «${state.open.path}» ещё не создан лист чертежа`;
      }
      return null;
    },
  };

  // Набор готовых сценариев для интерактивного прогона на стенде
  const scenarios = [
    {
      id: 'switch-to-drawing-ok',
      title: '1. Переключить на вкладку «Чертёж» (у детали есть лист)',
      state: initialState,
      bag: { action: { type: 'tab', tab: 'drawing', modelRev: 1 } },
      world: { drawings: ['parts/shaft'], features: ['extrude-1', 'hole-1'] },
    },
    {
      id: 'switch-to-drawing-refuse-assembly',
      title: '2. Попытка открыть «Чертёж» из режима сборки (Отказ по 0036)',
      state: {
        open: { kind: 'assembly', path: '' },
        shown: { sketches: true, skeleton: true },
        tab: 'model',
        rev: 2,
      },
      bag: { action: { type: 'tab', tab: 'drawing', modelRev: 2 } },
      world: { drawings: ['parts/shaft'], features: [] },
    },
    {
      id: 'pick-edge-stale-rev',
      title: '3. Выбор ребра по устаревшей ревизии геометрии (Отсечение гонки)',
      state: {
        open: { kind: 'part', path: 'parts/shaft', pick: { feature: null, face: null, edges: [] } },
        shown: { sketches: true, skeleton: true },
        tab: 'model',
        rev: 5,
      },
      bag: { action: { type: 'pick-edge', edge: 14, add: false, modelRev: 4 } },
      world: { drawings: ['parts/shaft'], features: ['extrude-1'] },
    },
    {
      id: 'open-assembly-resets-tab',
      title: '4. Открытие сборки при включённой вкладке «Чертёж» (Сброс на модель + rev++)',
      state: {
        open: { kind: 'part', path: 'parts/shaft', pick: { feature: 'extrude-1', face: 2, edges: [7] } },
        shown: { sketches: true, skeleton: true },
        tab: 'drawing',
        rev: 3,
      },
      bag: { action: { type: 'open', open: { kind: 'assembly', path: 'sub/drive' }, modelRev: 3 } },
      world: { drawings: ['parts/shaft'], features: [] },
    },
  ];

  return { initialState, fields, derived, scenarios };
});
