/* impl/steps.js — Чистые функции перехода данных для икон D.act.
   СТРАЖ ЧИСТОТЫ: запрещены let, var, class, this и прямые мутации входа (вход заморожен через deepFreeze). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NavImplSteps = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const emptyPick = { feature: null, face: null, edges: [] };

  return {
    capturePrev: (state) => ({
      bag: { prev: state },
      note: `снимок rev=${state.rev}`,
    }),

    applyOpen: (state, bag) => {
      const target = bag.action.open;
      const nextOpen =
        target.kind === 'part'
          ? { kind: 'part', path: target.path || null, pick: emptyPick }
          : { kind: 'assembly', path: target.path || '' };
      return {
        state: Object.assign({}, state, {
          open: nextOpen,
          tab: 'model',
          rev: state.rev + 1,
        }),
        note: `open=${nextOpen.kind}(${nextOpen.path || 'корень'}), tab=model, rev=${state.rev + 1}`,
      };
    },

    applyTab: (state, bag) => ({
      state: Object.assign({}, state, { tab: bag.action.tab }),
      note: `tab=${bag.action.tab}`,
    }),

    recordTabRefusal: (state, _bag, world) => {
      const reason =
        state.open.kind === 'assembly'
          ? 'В режиме сборки вкладка чертежа детали недоступна'
          : !state.open.path
            ? 'У детали-примера вне проекта нет чертежа'
            : !(world && world.drawings && world.drawings.includes(state.open.path))
              ? `У детали «${state.open.path}» ещё не создан чертёж`
              : 'Переключение вкладки отклонено';
      return {
        bag: { refusal: reason },
        note: reason,
      };
    },

    applyPick: (state, bag) => {
      const act = bag.action;
      const cur = state.open.pick || emptyPick;
      const nextPick =
        act.type === 'pick-edge'
          ? {
              feature: null,
              face: null,
              edges: act.add
                ? cur.edges.includes(act.edge)
                  ? cur.edges.filter((e) => e !== act.edge)
                  : cur.edges.concat([act.edge])
                : [act.edge],
            }
          : act.type === 'pick-face'
            ? { feature: cur.feature, face: act.face, edges: [] }
            : { feature: act.id || null, face: cur.face, edges: [] };

      return {
        state: Object.assign({}, state, {
          open: Object.assign({}, state.open, { pick: nextPick }),
        }),
        note: `edges=[${nextPick.edges.join(', ')}]`,
      };
    },

    computeEffects: (state, bag) => {
      const prev = bag.prev || state;
      const derivedMode = state.tab === 'drawing' ? 'drawing' : state.open.kind;
      const panels = []
        .concat(prev.open.kind !== state.open.kind || prev.open.path !== state.open.path ? ['scene', 'tree', 'crumbs'] : [])
        .concat(prev.tab !== state.tab ? ['tab', 'bar'] : [])
        .concat(JSON.stringify(prev.open.pick) !== JSON.stringify(state.open.pick) ? ['selection', 'context-bar'] : []);

      return {
        bag: {
          derivedMode,
          changedPanels: panels,
        },
        note: `mode="${derivedMode}", изменено панелей: ${panels.length}`,
      };
    },
  };
});
