/* impl/ports.js — Адаптеры внешних портов для полок D.shelf (ui, api).
   СТРАЖ ЧИСТОТЫ: никаких скрытых переменных (let/var/class/this) — только формирование команд внешнему миру. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NavImplPorts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    ui: {
      refuseStale: (state, bag) =>
        `Отброшено устаревшее действие (rev ${bag.action && bag.action.modelRev} ≠ ${state.rev})`,

      refuseTab: (_state, bag) => `Отказ: ${bag.refusal || 'вкладка недоступна'}`,

      refusePick: () => 'Отказ: выбор геометрии возможен только на 3D-модели детали',

      renderDiff: (_state, bag) =>
        `render(mode="${bag.derivedMode}", panels=[${(bag.changedPanels || []).join(', ')}])`,
    },
    api: {
      requestBuild: (state) =>
        state.open.kind === 'part'
          ? `api.call("part.build", { path: "${state.open.path}", rev: ${state.rev} })`
          : `api.call("assembly.evaluate", { path: "${state.open.path}", rev: ${state.rev} })`,
    },
  };
});
