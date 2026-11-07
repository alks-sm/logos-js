/* 2-plan.js — Управляющий автомат шлюза на языке ДРАКОН.
   Строго по Паронджанову («чем правее — тем хуже»):
   - На главном шампуре каждой ветки — только штатный «счастливый путь» (норма → допуск разрешён → завершение).
   - Все аварии, блокировки и отказы уходят строго ВПРАВО в ветки «нет» (no). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const D = require('../../../../vendor/drakon.js');
    module.exports = factory(D);
  } else {
    root.AccessPlan = factory(root.Drakon);
  }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const handleAccess = D.silhouette(
    'Контроллер шлюза безопасности: обработка такта события',
    [
      {
        name: 'Аварийный контур',
        items: [
          D.q('Датчики взлома и кнопка Panic в норме?', {
            down: 'да, в норме',
            right: 'нет, авария!',
            call: 'isSafetyNormal',
            no: [
              D.act('Включить режим Alarm и флаг сирены', { k: 'stop', call: 'enterAlarm' }),
              D.shelf('hw', 'Включить сирену и заблокировать ригель', { k: 'stop', call: 'soundSiren' }),
              D.go('Завершение такта'),
            ],
          }),
          D.go('Режим шлюза'),
        ],
      },
      {
        name: 'Режим шлюза',
        items: [
          D.q('Шлюз в штатном режиме допуска?', {
            down: 'да, штатный',
            right: 'нет, блокировка',
            call: 'isOperationalMode',
            no: [
              D.q('Предъявлен валидный мастер-ключ сброса?', {
                call: 'isMasterResetValid',
                no: [
                  D.act('Записать отказ: шлюз заблокирован', { k: 'stop', call: 'noteBlockedAttempt' }),
                  D.shelf('hw', 'Подать длинный сигнал отказа', { k: 'stop', call: 'beepReject' }),
                  D.go('Завершение такта'),
                ],
              }),
              D.act('Сбросить Alarm/Lockout в Armed, обнулить ошибки и сирену', { k: 'new', call: 'resetToArmed' }),
              D.shelf('hw', 'Отключить сирену и взвести штатную охрану', { call: 'silenceSiren' }),
              D.go('Завершение такта'),
            ],
          }),
          D.go('Проверка допуска'),
        ],
      },
      {
        name: 'Проверка допуска',
        items: [
          D.choice(
            'Тип штатного события',
            [
              [
                'pin',
                [
                  D.q('Введённый PIN-код верен?', {
                    call: 'isPinValid',
                    yes: [
                      D.act('Перевести в Unlocked и обнулить счётчик ошибок', { k: 'new', call: 'unlockAccess' }),
                      D.shelf('hw', 'Втянуть ригель замка на 5 секунд', { k: 'new', call: 'unlockBolt' }),
                    ],
                    no: [
                      D.act('Увеличить счётчик ошибок PIN (attempts + 1)', { call: 'incrementAttempts' }),
                      D.q('Остались попытки до блокировки (< 3)?', {
                        down: 'да, есть попытки',
                        right: 'нет, 3-я ошибка',
                        call: 'hasAttemptsLeft',
                        yes: [D.shelf('hw', 'Короткий сигнал неверного PIN', { k: 'stop', call: 'beepReject' })],
                        no: [
                          D.act('Перевести шлюз в режим Lockout', { k: 'stop', call: 'enterLockout' }),
                          D.shelf('hw', 'Включить блокировку клавиатуры на 30 с', { k: 'stop', call: 'lockKeypad' }),
                        ],
                      }),
                    ],
                  }),
                ],
              ],
              [
                'timeout',
                [
                  D.q('Дверь физически закрыта по геркону?', {
                    call: 'isDoorClosed',
                    yes: [
                      D.act('Вернуть шлюз из Unlocked в Armed', { call: 'relockDoor' }),
                      D.shelf('hw', 'Выдвинуть ригель замка', { call: 'lockBolt' }),
                    ],
                    no: [
                      D.act('Дверь удерживается открытой: перевести в Alarm!', { k: 'stop', call: 'enterAlarm' }),
                      D.shelf('hw', 'Включить сирену (дверь подпёрта)', { k: 'stop', call: 'soundSiren' }),
                    ],
                  }),
                ],
              ],
              [
                'service',
                [
                  D.q('Сервисный ключ инженера валиден?', {
                    call: 'isServiceKeyValid',
                    yes: [D.act('Переключить сервисный режим Maintenance ↔ Armed', { k: 'new', call: 'toggleMaintenance' })],
                    no: [D.shelf('hw', 'Сигнал отказа сервисного ключа', { k: 'stop', call: 'beepReject' })],
                  }),
                ],
              ],
            ],
            { call: 'classifyEvent' }
          ),
          D.go('Завершение такта'),
        ],
      },
      {
        name: 'Завершение такта',
        items: [
          D.act('Вычислить состояние ригеля boltLocked, остаток попыток и rev++', { call: 'finalizeTick' }),
          D.shelf('audit', 'Записать неизменяемую строку в журнал безопасности', { call: 'writeAuditLog' }),
          D.end('Такт шлюза завершён'),
        ],
      },
    ],
    {
      id: 'access-ctrl-flow',
      notes: [
        'Главный маршрут (шампур) каждой ветки идёт строго прямо сверху вниз без прерываний: Норма датчиков → Штатный режим → Верный PIN → Завершение такта. Все аварии и отказы уходят вправо.',
      ],
    }
  );

  return {
    schemes: {
      handleAccess,
    },
  };
});
