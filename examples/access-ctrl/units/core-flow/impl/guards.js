/* impl/guards.js — Чистые предикаты и селекторы контроллера шлюза безопасности.
   По канону ДРАКОНа: true всегда означает «норма / счастливый путь вниз по шампуру»,
   а false уводит поток вправо на обработку аварии, блокировки или отказа. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccessImplGuards = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    isSafetyNormal: (state, bag) => {
      const t = bag.action && bag.action.type;
      const isBreakIn = t === 'force-door' && state.mode !== 'unlocked' && state.mode !== 'maintenance';
      return t !== 'panic' && !isBreakIn;
    },

    isOperationalMode: (state) => state.mode !== 'alarm' && state.mode !== 'lockout',

    isMasterResetValid: (_state, bag, world) =>
      Boolean(
        bag.action &&
          bag.action.type === 'master-reset' &&
          world &&
          bag.action.masterKey === world.masterKey
      ),

    classifyEvent: (_state, bag) => {
      const t = bag.action && bag.action.type;
      if (t === 'timeout') return 'timeout';
      if (t === 'service') return 'service';
      return 'pin';
    },

    isPinValid: (_state, bag, world) =>
      Boolean(bag.action && world && bag.action.pin === world.validPin),

    hasAttemptsLeft: (state) => state.attempts < 3,

    isDoorClosed: (state) => !state.doorOpen,

    isServiceKeyValid: (_state, bag, world) =>
      Boolean(bag.action && world && bag.action.serviceKey === world.serviceKey),
  };
});
