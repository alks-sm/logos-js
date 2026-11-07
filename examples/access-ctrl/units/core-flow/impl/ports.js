/* impl/ports.js — Адаптеры внешних портов контроллера шлюза (hw — железо замка/сирены, audit — журнал).
   СТРАЖ ЧИСТОТЫ: 0 let, 0 var, 0 class, 0 this. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccessImplPorts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    hw: {
      soundSiren: () => 'HW: SIREN=ON, BOLT=LOCKED',
      silenceSiren: () => 'HW: SIREN=OFF, BOLT=LOCKED',
      unlockBolt: () => 'HW: BOLT=UNLOCKED (5s timer)',
      lockBolt: () => 'HW: BOLT=LOCKED',
      lockKeypad: () => 'HW: KEYPAD=LOCKED (30s)',
      beepReject: (state) => `HW: BEEP_REJECT (mode=${state.mode}, attempts=${state.attempts || 0}/3)`,
    },
    audit: {
      writeAuditLog: (state, bag) =>
        `AUDIT[rev=${state.rev}]: event=${bag.action && bag.action.type} -> mode=${state.mode}, boltLocked=${Boolean(bag.boltLocked)}, attempts=${state.attempts}`,
    },
  };
});
