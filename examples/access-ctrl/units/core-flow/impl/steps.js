/* impl/steps.js — Чистые преобразователи регистров контроллера шлюза безопасности.
   СТРАЖ ЧИСТОТЫ: 0 let, 0 var, 0 class, 0 this, 0 мутаций на месте. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccessImplSteps = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return {
    enterAlarm: (state, bag) => ({
      state: Object.assign({}, state, {
        mode: 'alarm',
        siren: true,
        doorOpen: (bag.action && bag.action.type === 'force-door') ? true : state.doorOpen,
      }),
      bag: {
        emergency: true,
        auditNote: 'АВАРИЯ: сработал контур тревоги',
      },
      note: 'mode="alarm", siren=true',
    }),

    noteBlockedAttempt: (state, bag) => ({
      bag: {
        auditNote: `Событие ${bag.action && bag.action.type} отклонено в режиме ${state.mode}`,
      },
      note: `отказ (${state.mode})`,
    }),

    resetToArmed: (state) => ({
      state: Object.assign({}, state, {
        mode: 'armed',
        attempts: 0,
        siren: false,
        doorOpen: false,
      }),
      bag: {
        auditNote: 'Сброс блокировки мастер-ключом начальника смены',
      },
      note: 'mode="armed", attempts=0, siren=false',
    }),

    unlockAccess: (state) => ({
      state: Object.assign({}, state, {
        mode: 'unlocked',
        attempts: 0,
      }),
      bag: {
        auditNote: 'Допуск разрешён по верному PIN',
      },
      note: 'mode="unlocked", attempts=0',
    }),

    incrementAttempts: (state) => ({
      state: Object.assign({}, state, {
        attempts: state.attempts + 1,
      }),
      note: `attempts=${state.attempts + 1}`,
    }),

    enterLockout: (state) => ({
      state: Object.assign({}, state, {
        mode: 'lockout',
      }),
      bag: {
        auditNote: 'Блокировка шлюза после 3 неверных попыток PIN',
      },
      note: 'mode="lockout" (3 ошибки)',
    }),

    relockDoor: (state) => ({
      state: Object.assign({}, state, {
        mode: 'armed',
      }),
      bag: {
        auditNote: 'Автозапирание по тайм-ауту',
      },
      note: 'mode="armed"',
    }),

    toggleMaintenance: (state) => {
      const nextMode = state.mode === 'maintenance' ? 'armed' : 'maintenance';
      return {
        state: Object.assign({}, state, {
          mode: nextMode,
          attempts: 0,
        }),
        bag: {
          auditNote: `Переключение сервисного режима -> ${nextMode}`,
        },
        note: `mode="${nextMode}"`,
      };
    },

    finalizeTick: (state) => {
      const boltLocked = state.mode !== 'unlocked' && state.mode !== 'maintenance';
      const remainingAttempts = Math.max(0, 3 - state.attempts);
      return {
        state: Object.assign({}, state, {
          rev: state.rev + 1,
        }),
        bag: {
          boltLocked,
          remainingAttempts,
        },
        note: `rev=${state.rev + 1}, boltLocked=${boltLocked}`,
      };
    },
  };
});
