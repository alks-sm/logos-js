/* 2-plan.js — Скелет (План исполнения на языке ДРАКОН).
   Никакого императивного кода: только иконы ДРАКОНа и привязки { call: '<id колбэка>' }.
   Эта же структура напрямую рисуется в SVG через Drakon.figure() и исполняется через Logos.Runtime.run()! */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const D = require('../../vendor/drakon.js');
    module.exports = factory(D);
  } else {
    root.NavPlan = factory(root.Drakon);
  }
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const applyNav = D.silhouette(
    'Диспетчер состояния окна apply(state, action)',
    [
      {
        name: 'Проверка ревизии',
        items: [
          D.act('Зафиксировать снимок до перехода', { call: 'capturePrev' }),
          D.q('Ревизия действия актуальна?', {
            call: 'isRevFresh',
            no: [
              D.shelf('ui', 'Отклонить устаревшее действие (stale rev)', { k: 'stop', call: 'refuseStale' }),
              D.go('Итог'),
            ],
          }),
          D.go('Маршрут действия'),
        ],
      },
      {
        name: 'Маршрут действия',
        items: [
          D.choice(
            'Вид действия (action.type)',
            [
              [
                'open',
                [
                  D.act('Сменить открытый узел, сбросить выбор и вкладку, rev++', { k: 'new', call: 'applyOpen' }),
                  D.shelf('api', 'Запросить пересборку открытого узла (rev)', { call: 'requestBuild' }),
                ],
              ],
              [
                'tab',
                [
                  D.q('Вкладка допустима для открытого узла?', {
                    call: 'canSwitchTab',
                    no: [
                      D.act('Записать причину отказа whyNotDrawing', { k: 'stop', call: 'recordTabRefusal' }),
                      D.shelf('ui', 'Показать причину отказа в строке состояния', { k: 'stop', call: 'refuseTab' }),
                    ],
                    yes: [D.act('Переключить вкладку (model / drawing)', { k: 'new', call: 'applyTab' })],
                  }),
                ],
              ],
              [
                'pick',
                [
                  D.q('Открыта деталь в режиме модели?', {
                    call: 'isPartModelOpen',
                    no: [D.shelf('ui', 'Выбор граней/рёбер вне детали игнорируется', { k: 'stop', call: 'refusePick' })],
                    yes: [D.act('Обновить выбор внутри открытой детали (pick)', { k: 'new', call: 'applyPick' })],
                  }),
                ],
              ],
            ],
            { call: 'actionCategory' }
          ),
          D.go('Итог'),
        ],
      },
      {
        name: 'Итог',
        items: [
          D.act('Вычислить производный режим modeOf и список изменённых панелей', { call: 'computeEffects' }),
          D.shelf('ui', 'Синхронизировать шапку, вкладки и панели по диффу', { k: 'new', call: 'renderDiff' }),
          D.end('Переход завершён'),
        ],
      },
    ],
    {
      id: 'nav-apply',
      notes: [
        'Иконы q и choice вызывают чистые предикаты (impl/guards.js); иконы act — чистые переходы данных (impl/steps.js); иконы-полки shelf — внешние порты (impl/ports.js).',
      ],
    }
  );

  return {
    schemes: {
      applyNav,
    },
  };
});
