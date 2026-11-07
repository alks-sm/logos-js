/* 1-schema.js — Регистры состояния, вычисляемые флаги и 6 боевых сценариев контроллера шлюза безопасности. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccessSchema = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const initialState = {
    mode: 'armed',     // 'armed' | 'unlocked' | 'lockout' | 'alarm' | 'maintenance'
    attempts: 0,       // число ошибок ввода PIN подряд (0..3)
    doorOpen: false,   // физический геркон двери (закрыта / открыта)
    siren: false,      // ревун тревоги
    rev: 1,            // счётчик тактов контроллера
  };

  // Вычисляемые флаги (Derived) — никогда не хранятся в State, всегда вычисляются из него!
  const derived = {
    boltLocked: (state) => state.mode !== 'unlocked' && state.mode !== 'maintenance',
    remainingAttempts: (state) => Math.max(0, 3 - state.attempts),
  };

  const defaultWorld = {
    validPin: '4821',
    masterKey: 'MSTR-900',
    serviceKey: 'SVC-77',
  };

  const scenarios = [
    {
      id: 'pin-ok-unlock',
      title: '1. Верный PIN (после 1 ошибки) → Открытие ригеля и сброс счётчика',
      state: { mode: 'armed', attempts: 1, doorOpen: false, siren: false, rev: 10 },
      bag: { action: { type: 'pin', pin: '4821' } },
      world: defaultWorld,
    },
    {
      id: 'third-wrong-pin-lockout',
      title: '2. Третий неверный PIN подряд (attempts: 2 → 3) → Блокировка (Lockout)',
      state: { mode: 'armed', attempts: 2, doorOpen: false, siren: false, rev: 11 },
      bag: { action: { type: 'pin', pin: '0000' } },
      world: defaultWorld,
    },
    {
      id: 'valid-pin-during-lockout',
      title: '3. Попытка ввести верный PIN в режиме Lockout → Жёсткий отказ (нужен мастер-ключ)',
      state: { mode: 'lockout', attempts: 3, doorOpen: false, siren: false, rev: 12 },
      bag: { action: { type: 'pin', pin: '4821' } },
      world: defaultWorld,
    },
    {
      id: 'master-reset-from-lockout',
      title: '4. Сброс блокировки Lockout валидным мастер-ключом начальника смены',
      state: { mode: 'lockout', attempts: 3, doorOpen: false, siren: false, rev: 13 },
      bag: { action: { type: 'master-reset', masterKey: 'MSTR-900' } },
      world: defaultWorld,
    },
    {
      id: 'timeout-propped-door-alarm',
      title: '5. Истёк тайм-аут открытия, но дверь подпёрта (doorOpen=true) → Тревога и сирена!',
      state: { mode: 'unlocked', attempts: 0, doorOpen: true, siren: false, rev: 14 },
      bag: { action: { type: 'timeout' } },
      world: defaultWorld,
    },
    {
      id: 'forced-break-in-alarm',
      title: '6. Взлом закрытой двери фомкой (force-door в режиме armed) → Мгновенный Alarm',
      state: { mode: 'armed', attempts: 0, doorOpen: false, siren: false, rev: 15 },
      bag: { action: { type: 'force-door' } },
      world: defaultWorld,
    },
  ];

  return { initialState, derived, defaultWorld, scenarios };
});
