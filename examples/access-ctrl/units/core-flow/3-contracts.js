/* 3-contracts.js — Контракты всех 18 колбэков контроллера шлюза с изолированными тест-кейсами (cases). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AccessContracts = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  return [
    /* ── Датчики и предикаты (guards) — «да» всегда ведёт по счастливому пути вниз! ── */
    {
      id: 'isSafetyNormal',
      kind: 'guard',
      title: 'Датчики взлома и кнопка Panic в норме (нет экстренной аварии)',
      reads: ['state.mode', 'bag.action.type'],
      cases: [
        { title: 'обычный ввод pin → true (норма, вниз по шампуру)', state: { mode: 'armed' }, bag: { action: { type: 'pin' } }, expect: true },
        { title: 'кнопка panic → false (авария, вправо!)', state: { mode: 'armed' }, bag: { action: { type: 'panic' } }, expect: false },
        { title: 'взлом force-door при охране → false (авария, вправо!)', state: { mode: 'armed' }, bag: { action: { type: 'force-door' } }, expect: false },
      ],
    },
    {
      id: 'isOperationalMode',
      kind: 'guard',
      title: 'Шлюз находится в штатном рабочем режиме (не в Alarm и не в Lockout)',
      reads: ['state.mode'],
      cases: [
        { title: 'armed → true (штатный, вниз по шампуру)', state: { mode: 'armed' }, expect: true },
        { title: 'lockout → false (блокировка, вправо)', state: { mode: 'lockout' }, expect: false },
        { title: 'alarm → false (тревога, вправо)', state: { mode: 'alarm' }, expect: false },
      ],
    },
    {
      id: 'isMasterResetValid',
      kind: 'guard',
      title: 'Проверка мастер-ключа начальника смены для снятия Alarm/Lockout',
      reads: ['bag.action', 'world.masterKey'],
      cases: [
        {
          title: 'верный мастер-ключ → true',
          bag: { action: { type: 'master-reset', masterKey: 'MSTR-900' } },
          world: { masterKey: 'MSTR-900' },
          expect: true,
        },
        {
          title: 'обычный PIN во время Lockout → false',
          bag: { action: { type: 'pin', pin: '4821' } },
          world: { masterKey: 'MSTR-900' },
          expect: false,
        },
      ],
    },
    {
      id: 'classifyEvent',
      kind: 'guard',
      title: 'Маршрутизация штатного события: pin / timeout / service',
      reads: ['bag.action.type'],
      cases: [
        { title: 'событие pin', bag: { action: { type: 'pin' } }, expect: 'pin' },
        { title: 'событие timeout', bag: { action: { type: 'timeout' } }, expect: 'timeout' },
        { title: 'событие service', bag: { action: { type: 'service' } }, expect: 'service' },
      ],
    },
    {
      id: 'isPinValid',
      kind: 'guard',
      title: 'Сверка введённого PIN-кода с эталоном world.validPin',
      reads: ['bag.action.pin', 'world.validPin'],
      cases: [
        { title: 'верный PIN 4821 → true', bag: { action: { pin: '4821' } }, world: { validPin: '4821' }, expect: true },
        { title: 'неверный PIN 0000 → false', bag: { action: { pin: '0000' } }, world: { validPin: '4821' }, expect: false },
      ],
    },
    {
      id: 'hasAttemptsLeft',
      kind: 'guard',
      title: 'Остались ли ещё попытки ввода PIN до блокировки (state.attempts < 3)',
      reads: ['state.attempts'],
      cases: [
        { title: '2 ошибки → true (попытки ещё есть)', state: { attempts: 2 }, expect: true },
        { title: '3 ошибки → false (лимит исчерпан, вправо в Lockout)', state: { attempts: 3 }, expect: false },
      ],
    },
    {
      id: 'isDoorClosed',
      kind: 'guard',
      title: 'Проверка датчика закрытия двери (!state.doorOpen)',
      reads: ['state.doorOpen'],
      cases: [
        { title: 'дверь закрыта → true', state: { doorOpen: false }, expect: true },
        { title: 'дверь открыта/подпёрта → false', state: { doorOpen: true }, expect: false },
      ],
    },
    {
      id: 'isServiceKeyValid',
      kind: 'guard',
      title: 'Проверка сервисного токена инженера (world.serviceKey)',
      reads: ['bag.action.serviceKey', 'world.serviceKey'],
      cases: [
        { title: 'верный ключ → true', bag: { action: { serviceKey: 'SVC-77' } }, world: { serviceKey: 'SVC-77' }, expect: true },
        { title: 'чужой ключ → false', bag: { action: { serviceKey: 'BAD' } }, world: { serviceKey: 'SVC-77' }, expect: false },
      ],
    },

    /* ── Чистые преобразователи регистров (steps) ── */
    {
      id: 'enterAlarm',
      kind: 'step',
      title: 'Перевести контроллер в режим тревоги (mode="alarm", siren=true)',
      writes: ['state.mode', 'state.siren', 'bag.emergency'],
      cases: [
        {
          title: 'включает alarm и сирену',
          state: { mode: 'armed', attempts: 0, doorOpen: false, siren: false, rev: 1 },
          bag: { action: { type: 'force-door' } },
          check: (res) => res.state.mode === 'alarm' && res.state.siren === true && res.bag.emergency === true,
        },
      ],
    },
    {
      id: 'noteBlockedAttempt',
      kind: 'step',
      title: 'Зафиксировать в bag.auditNote попытку доступа при заблокированном шлюзе',
      writes: ['bag.auditNote'],
      cases: [
        {
          title: 'пишет причину отказа в bag.auditNote',
          state: { mode: 'lockout' },
          bag: { action: { type: 'pin' } },
          check: (res) => res.bag.auditNote.includes('отклонено в режиме lockout'),
        },
      ],
    },
    {
      id: 'resetToArmed',
      kind: 'step',
      title: 'Сбросить блокировку/тревогу в штатный режим Armed (attempts=0, siren=false)',
      writes: ['state.mode', 'state.attempts', 'state.siren'],
      cases: [
        {
          title: 'сбрасывает lockout в armed и обнуляет attempts',
          state: { mode: 'lockout', attempts: 3, doorOpen: false, siren: true, rev: 5 },
          check: (res) => res.state.mode === 'armed' && res.state.attempts === 0 && res.state.siren === false,
        },
      ],
    },
    {
      id: 'unlockAccess',
      kind: 'step',
      title: 'Открыть допуск (mode="unlocked", attempts=0)',
      writes: ['state.mode', 'state.attempts'],
      cases: [
        {
          title: 'переводит в unlocked и сбрасывает счётчик ошибок',
          state: { mode: 'armed', attempts: 2, doorOpen: false, siren: false, rev: 3 },
          check: (res) => res.state.mode === 'unlocked' && res.state.attempts === 0,
        },
      ],
    },
    {
      id: 'incrementAttempts',
      kind: 'step',
      title: 'Увеличить счётчик неудачных попыток ввода PIN на 1',
      writes: ['state.attempts'],
      cases: [
        {
          title: 'attempts 2 → 3',
          state: { mode: 'armed', attempts: 2, doorOpen: false, siren: false, rev: 3 },
          check: (res) => res.state.attempts === 3,
        },
      ],
    },
    {
      id: 'enterLockout',
      kind: 'step',
      title: 'Блокировать шлюз после 3 ошибок PIN (mode="lockout")',
      writes: ['state.mode'],
      cases: [
        {
          title: 'переводит в lockout',
          state: { mode: 'armed', attempts: 3, doorOpen: false, siren: false, rev: 3 },
          check: (res) => res.state.mode === 'lockout',
        },
      ],
    },
    {
      id: 'relockDoor',
      kind: 'step',
      title: 'Запереть шлюз по истечении времени прохода (mode="armed")',
      writes: ['state.mode'],
      cases: [
        {
          title: 'переводит из unlocked в armed',
          state: { mode: 'unlocked', attempts: 0, doorOpen: false, siren: false, rev: 4 },
          check: (res) => res.state.mode === 'armed',
        },
      ],
    },
    {
      id: 'toggleMaintenance',
      kind: 'step',
      title: 'Переключить сервисный режим инженера (maintenance ↔ armed)',
      writes: ['state.mode'],
      cases: [
        {
          title: 'armed → maintenance',
          state: { mode: 'armed', attempts: 0, doorOpen: false, siren: false, rev: 1 },
          check: (res) => res.state.mode === 'maintenance',
        },
      ],
    },
    {
      id: 'finalizeTick',
      kind: 'step',
      title: 'Вычислить производные флаги (boltLocked, remainingAttempts) и инкрементировать rev++',
      writes: ['state.rev', 'bag.boltLocked', 'bag.remainingAttempts'],
      cases: [
        {
          title: 'инкрементирует rev и считает boltLocked',
          state: { mode: 'unlocked', attempts: 0, doorOpen: false, siren: false, rev: 10 },
          check: (res) => res.state.rev === 11 && res.bag.boltLocked === false && res.bag.remainingAttempts === 3,
        },
      ],
    },

    /* ── Внешние аппаратные и журнальные порты (ports для D.shelf) ── */
    {
      id: 'soundSiren',
      kind: 'port',
      port: 'hw',
      title: 'Включить аппаратную сирену и заблокировать электромагнитный ригель',
      cases: [{ title: 'команда сирены', state: { mode: 'alarm' }, expect: 'HW: SIREN=ON, BOLT=LOCKED' }],
    },
    {
      id: 'silenceSiren',
      kind: 'port',
      port: 'hw',
      title: 'Отключить сирену после сброса мастер-ключом',
      cases: [{ title: 'команда отключения сирены', state: { mode: 'armed' }, expect: 'HW: SIREN=OFF, BOLT=LOCKED' }],
    },
    {
      id: 'unlockBolt',
      kind: 'port',
      port: 'hw',
      title: 'Подать импульс открытия ригеля замка на 5 секунд',
      cases: [{ title: 'импульс соленоида', state: { mode: 'unlocked' }, expect: 'HW: BOLT=UNLOCKED (5s timer)' }],
    },
    {
      id: 'lockBolt',
      kind: 'port',
      port: 'hw',
      title: 'Выдвинуть ригель замка при постановке на охрану',
      cases: [{ title: 'запирание ригеля', state: { mode: 'armed' }, expect: 'HW: BOLT=LOCKED' }],
    },
    {
      id: 'lockKeypad',
      kind: 'port',
      port: 'hw',
      title: 'Заблокировать PIN-клавиатуру на 30 секунд при Lockout',
      cases: [{ title: 'блокировка клавиатуры', state: { mode: 'lockout' }, expect: 'HW: KEYPAD=LOCKED (30s)' }],
    },
    {
      id: 'beepReject',
      kind: 'port',
      port: 'hw',
      title: 'Звуковой сигнал отказа на считывателе',
      cases: [
        {
          title: 'сигнал отказа с остатком попыток',
          state: { mode: 'armed', attempts: 1 },
          expect: 'HW: BEEP_REJECT (mode=armed, attempts=1/3)',
        },
      ],
    },
    {
      id: 'writeAuditLog',
      kind: 'port',
      port: 'audit',
      title: 'Записать неизменяемую запись такта в журнал безопасности',
      cases: [
        {
          title: 'строка журнала аудита',
          state: { mode: 'unlocked', attempts: 0, rev: 11 },
          bag: { action: { type: 'pin' }, boltLocked: false },
          expect: 'AUDIT[rev=11]: event=pin -> mode=unlocked, boltLocked=false, attempts=0',
        },
      ],
    },
  ];
});
