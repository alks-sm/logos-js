/* impl/guards.js — Чистые предикаты и селекторы для вопросов D.q и D.choice.
   СТРАЖ ЧИСТОТЫ: в этом файле запрещены let, var, class, this и доступ к DOM/глобалам. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NavImplGuards = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    isRevFresh: (state, bag) =>
      bag.action && bag.action.modelRev !== undefined ? bag.action.modelRev === state.rev : true,

    actionCategory: (_state, bag) => {
      const t = bag.action && bag.action.type;
      if (t === 'open') return 'open';
      if (t === 'tab') return 'tab';
      return 'pick';
    },

    canSwitchTab: (state, bag, world) => {
      const targetTab = bag.action && bag.action.tab;
      if (targetTab === 'model') return true;
      if (state.open.kind === 'assembly') return false;
      if (!state.open.path) return false;
      const list = (world && world.drawings) || [];
      return list.includes(state.open.path);
    },

    isPartModelOpen: (state) => state.open.kind === 'part' && state.tab === 'model',
  };
});
