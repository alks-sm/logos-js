/* impl/guards.js — Чистые предикаты и селекторы контроллера шлюза безопасности.
   СТРАЖ ЧИСТОТЫ: 0 let, 0 var, 0 class, 0 this, 0 DOM. Вход заморожен через deepFreeze. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccessImplGuards = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    isEmergencyTrigger: (state, bag) => {
      const t = bag.action && bag.action.type;
      return t === 'panic' || (t === 'force-door' && state.mode !== 'unlocked' && state.mode !== 'maintenance');
    },

    isEmergencyTriggeredNow: (_state, bag) => Boolean(bag.emergency),

    isInLockedDownMode: (state) => state.mode === 'alarm' || state.mode === 'lockout',

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

    isMaxAttemptsReached: (state) => state.attempts >= 3,

    isDoorClosed: (state) => !state.doorOpen,

    isServiceKeyValid: (_state, bag, world) =>
      Boolean(bag.action && world && bag.action.serviceKey === world.serviceKey),
  };
});
