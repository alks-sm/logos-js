/* Эталонная модель архитектуры Keel в базе Logos.
   Работает и в браузере (глобальный KeelModel), и в Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Lg = require('../logos.js');
    module.exports = factory(Lg, Lg.Drakon, Lg.Lanes);
  } else {
    root.KeelModel = factory(root.Logos, root.Drakon, root.Lanes);
  }
})(typeof self !== 'undefined' ? self : this, function (Lg, D, L) {
  'use strict';

  return Lg.project(
    {
      id: 'keel',
      title: 'Keel — параметрический механический CAD',
      summary:
        'Замена процессу КБ в Inventor: ошибки ссылок, потери номеров (PN) и рассинхрон состояния окна невозможны по построению.',
    },
    {
      repo: {
        root: '/mnt/Projects/apps/keel',
        stack: ['TypeScript', 'Node.js', 'Electron', 'Vite', 'Zod', 'Replicad'],
        requiredFiles: ['biome.json', 'tsconfig.base.json', 'vitest.config.ts'],
        requiredScripts: ['build', 'smoke'],
        decisionsDir: 'docs/decisions',
      },
      /* 1. Словарь терминов и констант (одно слово = один смысл) */
      terms: [
        Lg.term('Part', 'Деталь', 'Чистая функция (params, inputs) → Body. Не хранит ссылок на сборку.', {
          const: 'PartSchema (strictObject)',
        }),
        Lg.term('Skeleton', 'Скелет', 'Опорная геометрия, принадлежащая сборке и явно проецируемая во входы деталей.', {
          const: '0004',
        }),
        Lg.term('Fingerprint', 'Отпечаток', 'Геометрический паспорт именованной грани/ребра для восстановления ссылок по образцу.', {
          const: '0003 / 0034',
        }),
        Lg.term('ProductCommit', 'Продуктовый коммит', 'Неизменяемый снимок сборки на главной ветке, выдающий заводские номера (PN) по правилам предприятия.', {
          const: '0008 / 0009',
        }),
        Lg.term('Affordance', 'Допустимое действие', 'Объект { id, label, can, run }, вычисляемый из состояния и модели одним кодом для бара, палитры и клавиш.', {
          const: '0036',
        }),
        Lg.term('Socket', 'Разъём плагина', 'Официальная точка расширения ядра, API и окна со строгим входным контрактом и проверкой инвариантов.', {
          const: 'logos:socket',
        }),
      ],

      /* 2. Принятые архитектурные решения (docs/decisions/) */
      decisions: [
        Lg.decision('0001', 'Невозможно по построению', 'Проблемы Inventor исключаются самой моделью данных, а не проверками поверх хрупких ссылок.', { file: '0001-immutable-data.md' }),
        Lg.decision('0003', 'Ссылки только на именованные элементы', 'Никаких индексов Face_42: операции ссылаются только на именованные элементы и их отпечатки.', { file: '0003-robust-refs.md' }),
        Lg.decision('0004', 'Скелет принадлежит сборке', 'Скелет живёт в сборке и передаётся в деталь только через явные входы (inputs).', { file: '0004-skeleton-ownership.md' }),
        Lg.decision('0006', 'Деталь — чистая функция', 'Тело детали полностью определяется её параметрами и входами: Part(params, inputs) → Body.', { file: '0006-pure-part.md' }),
        Lg.decision('0008', 'Номера PN выдаёт продуктовый коммит', 'Обозначения деталей присваиваются атомарно по правилам предприятия при продуктовом коммите.', { file: '0008-atomic-pn.md' }),
        Lg.decision('0011', 'Механизм, не политика', 'Уклад конкретного завода (сортамент, допуски, форма PN, припуски техпроцесса) — это данные правил, а не код ядра.', { file: '0011-rules-as-data.md' }),
        Lg.decision('0015', 'Отказ остаётся локальным', 'Сбой одной операции или пересечения не роняет пересборку всей детали и освобождает ресурсы WASM.', { file: '0015-isolation.md' }),
        Lg.decision('0019', 'Единый командный слой', 'Окно Electron/Web, тесты и MCP-агенты работают через один слой команд @keel/api со схемами Zod.', { file: '0019-api-layer.md' }),
        Lg.decision('0036', 'Состояние окна — данные', 'Место окна (Nav) — данные; производное (modeOf) вычисляется; допустимое строится тем же кодом, что исполняет.', { file: '0036-nav-as-data.md' }),
      ],

      /* 3. Инварианты и их автоматические стражи */
      invariants: [
        Lg.invariant('INV-01', 'Деталь не читает контекст сборки напрямую', '0006', {
          why: 'Иначе деталь нельзя переиспользовать и кэшировать по хэшу конструкции.',
          guard: 'packages/core/src/model/serialize.ts + запрет импорта store/api/app',
          scope: ['core', 'store'],
          rules: [
            {
              kind: 'forbid-regex',
              dir: 'packages/core',
              pattern: 'import.*from.*@keel/(api|app|store)',
              message: 'core не должен знать про app, api, store',
            },
          ],
        }),
        Lg.invariant('INV-02', 'Ссылки на геометрию — только по именованным ролям и отпечаткам', '0003', {
          why: 'Защита от «поехавших» граней при перестроении дерева операций.',
          guard: 'packages/core/src/model/validate.ts + recognize/pose.test.ts',
          scope: ['kernel', 'core'],
          rules: [
            {
              kind: 'file-exists',
              paths: ['packages/core/src/model/validate.ts', 'packages/core/src/recognize/pose.test.ts'],
              message: 'Геометрический паспорт и тесты восстановления по образцу',
            },
          ],
        }),
        Lg.invariant('INV-03', 'Каждая операция ядра OCCT освобождает память WASM', '0015', {
          why: 'Утечка C++ хэндлов на неудачных булевых операциях убивает процесс.',
          guard: 'packages/kernel/src/occt/memory.test.ts (Scope + disposeTool)',
          scope: ['kernel'],
          rules: [
            {
              kind: 'file-exists',
              paths: ['packages/kernel/src/occt/memory.test.ts'],
              message: 'Тест контроля WASM-кучи OCCT',
            },
            {
              kind: 'require-regex',
              file: 'packages/kernel/src/occt/index.ts',
              pattern: 'disposeTool',
              message: 'Освобождение C++ хэндлов через disposeTool в OCCT-ядре',
            },
          ],
        }),
        Lg.invariant('INV-04', 'Выдача PN и запись продуктового коммита атомарны', '0008', {
          why: 'Обрыв записи между pn.jsonl и refs.jsonl не должен сжигать заводские номера.',
          guard: 'packages/store/src/store.test.ts + product.test.ts',
          scope: ['store'],
          rules: [
            {
              kind: 'file-exists',
              paths: ['packages/store/src/store.test.ts', 'packages/store/src/product.test.ts'],
              message: 'Тесты продуктового коммита и хранилища',
            },
          ],
        }),
        Lg.invariant('INV-05', 'Все команды @keel/api валидируются strictObject', '0019', {
          why: 'Единый контракт для UI, MCP и будущих плагинов.',
          guard: 'packages/api/src/api.test.ts',
          scope: ['api', 'mcp'],
          rules: [
            {
              kind: 'file-exists',
              paths: ['packages/api/src/api.test.ts'],
              message: 'Тест командного слоя @keel/api',
            },
          ],
        }),
        Lg.invariant('INV-06', 'Вся верстка и тексты — только через реестры ui/', '0036', {
          why: 'Нейросети не должны размазывать DOM, classList и тексты по прикладным модулям.',
          guard: 'packages/app/src/renderer/ui/guard.test.ts',
          scope: ['app'],
          rules: [
            {
              kind: 'file-exists',
              paths: ['packages/app/src/renderer/ui/guard.test.ts'],
              message: 'Охранный тест реестров UI (kit, mech, words)',
            },
          ],
        }),
        Lg.invariant('INV-07', 'Режим окна и вкладка чертежа — тотальная функция от Nav', '0036', {
          why: 'Исключает рассинхрон состояния окна.',
          guard: 'packages/app/src/renderer/window-state.test.ts',
          scope: ['app'],
          rules: [
            {
              kind: 'file-exists',
              paths: ['packages/app/src/renderer/window-state.test.ts'],
              message: 'Тест перебора цепочек переходов Nav',
            },
          ],
        }),
        Lg.invariant('INV-08', 'Плагин расширяет систему только через сокеты', '0011', {
          why: 'Позволяет подключать Frame Generator и Генератор шестерёнок изолированными пакетами.',
          guard: null,
          scope: ['core', 'api', 'app'],
          rules: [],
        }),
      ],

      /* 4. Слои и модули (с привязкой к структуре диска) */
      modules: [
        Lg.moduleDef('kernel', 'Ядро геометрии и эскизов', 0, {
          path: 'packages/kernel',
          role: 'OCCT в WASM/Node + собственный 2D-решатель эскизов',
          files: ['src/occt', 'src/sketch'],
        }),
        Lg.moduleDef('drafting', 'Движок черчения ЕСКД', 0, {
          path: 'packages/drafting',
          role: 'Раскладка видов, размеров, рамок и генерация SVG по ГОСТ',
          files: ['gost.css', 'tokens.css'],
        }),
        Lg.moduleDef('core', 'Модель, сборка и правила', 1, {
          path: 'packages/core',
          role: 'Схемы детали и сборки, выражения, пересчёт, стандарты ISO/ГОСТ, PDF',
          deps: ['kernel', 'drafting'],
        }),
        Lg.moduleDef('store', 'Хранилище и коммиты', 1, {
          path: 'packages/store',
          role: 'Объекты по SHA-256, ветки, слияние, выпуск и продуктовые коммиты (PN)',
          deps: ['core', 'kernel'],
        }),
        Lg.moduleDef('api', 'Командный слой', 2, {
          path: 'packages/api',
          role: 'Реестр команд со схемами входа, сеанс проекта, черновики',
          deps: ['core', 'store', 'kernel'],
        }),
        Lg.moduleDef('mcp', 'MCP-сервер для агентов', 3, {
          path: 'packages/mcp',
          role: 'Транспорт stdio поверх @keel/api для внешних ИИ-инструментов',
          deps: ['api', 'core'],
        }),
        Lg.moduleDef('app', 'Окно Keel (Electron / Web)', 3, {
          path: 'packages/app',
          role: 'Состояние Nav, реестры UI, 3D-сцена, редактор эскиза и листа',
          deps: ['api', 'core', 'kernel'],
        }),
      ],

      /* 5. Разъёмы под будущие плагины (Frame Generator, Шестерни, Правила завода) */
      sockets: [
        Lg.socket('socket:feature', 'Операция детали (Feature Plugin)', 'core', {
          contract: 'Регистрация { kind, paramSchema, build(params, inputs, kernel) → Body, drawingRules }',
          invariants: ['INV-01', 'INV-02', 'INV-03', 'INV-08'],
          examples: ['Цилиндрическая шестерня (ГОСТ 16532)', 'Шлицевой вал', 'Сварная разделка кромки'],
        }),
        Lg.socket('socket:assembly-gen', 'Генератор узла сборки (Assembly Generator)', 'core', {
          contract: 'Чистая функция (skeletonEdges, profileCatalog, rules) → { parts[], instances[], mates[] }',
          invariants: ['INV-01', 'INV-02', 'INV-08'],
          examples: ['Frame Generator (рама из профилей по рёбрам скелета)', 'Болтовой пакет по отверстиям соединения'],
        }),
        Lg.socket('socket:company-rules', 'Пакет правил и переходов техпроцесса', 'store', {
          contract: 'Данные CompanyRules: шаблоны PN, сортамент, допуски и коэффициенты переходов (лазер → расточка)',
          invariants: ['INV-04', 'INV-08'],
          examples: ['Правила бюро (припуск 0,5 мм под расточку, отверстия под резьбу)', 'Экспорт DXF развёртки/контура'],
        }),
        Lg.socket('socket:ui-tool', 'Инструмент и панель окна (UI Plugin)', 'app', {
          contract: 'Декларативная запись { id, when(nav), affordances(nav, model), panelSpec(kit, words) } без прямого доступа к DOM',
          invariants: ['INV-05', 'INV-06', 'INV-07', 'INV-08'],
          examples: ['Панель подбора профиля Frame Generator', 'Интерактивный расчёт зацепления шестерёнок'],
        }),
      ],

      /* 6. Автомат состояний окна (0036: Nav + стек возврата Esc) */
      states: [
        Lg.state('assembly', 'Сборка / Проект', {
          initial: true,
          owns: ['project', 'branch', 'assemblyPath', 'selectedInstance'],
          derived: ['mode = "assembly"', 'dirty', 'crumbs'],
        }),
        Lg.state('layout', 'Компоновка (скелет)', {
          owns: ['layoutId', 'selectedEntities', 'tool'],
          derived: ['mode = "sketch"', 'canCreatePartFromContour'],
        }),
        Lg.state('part', 'Деталь (3D-модель)', {
          owns: ['partPath', 'selection (feature|face|edges)', 'modelRev'],
          derived: ['mode = "part"', 'hasDrawing', 'affordances'],
        }),
        Lg.state('sketch', 'Эскиз детали', {
          owns: ['sketchId', 'tool', 'selectedIds', 'collecting'],
          derived: ['mode = "sketch"', 'dof', 'conflicts'],
        }),
        Lg.state('drawing', 'Лист чертежа', {
          owns: ['selectedKeys', 'history'],
          derived: ['mode = "drawing"', 'whyNotTab', 'sheetAffordances'],
        }),
      ],

      transitions: [
        Lg.transition('assembly', 'Открыть компоновку (S)', 'layout', {
          can: 'сборка открыта',
          effect: 'загрузить эскиз скелета',
        }),
        Lg.transition('layout', 'Готово / закрыть компоновку', 'assembly', {
          isEsc: true,
          effect: 'пересчитать входы деталей от скелета',
        }),
        Lg.transition('assembly', 'Открыть деталь (двойной щелчок)', 'part', {
          can: 'выбран компонент детали',
          effect: 'запрос part.build с ключом ревизии',
        }),
        Lg.transition('part', 'Вернуться в сборку (путь / Esc)', 'assembly', {
          isEsc: true,
          effect: 'обновить положение и черновик сборки',
        }),
        Lg.transition('part', 'Редактировать эскиз (S / E)', 'sketch', {
          can: 'выбрана плоская грань или эскиз',
          effect: 'открыть решатель эскиза',
        }),
        Lg.transition('sketch', 'Готово (выход из эскиза)', 'part', {
          isEsc: true,
          effect: 'пересобрать 3D-тело детали (rev++)',
        }),
        Lg.transition('part', 'Открыть вкладку «Чертёж»', 'drawing', {
          can: 'whyNotTab === undefined (деталь проекта с чертежом)',
          effect: 'вызов document.svg',
          refuse: 'Чертёж доступен только для детали проекта, у которой создан лист',
        }),
        Lg.transition('drawing', 'К модели (вкладка «Модель» / Esc)', 'part', {
          isEsc: true,
          effect: 'вернуться к 3D-сцене той же детали',
        }),
      ],

      /* 7. Протоколы взаимодействия во времени (lanes-js) */
      protocols: [
        {
          id: 'proto-plugin-frame',
          module: 'core',
          scheme: L.sequence('Плагин Frame Generator: построение рамы по скелету сборки', {
            lanes: [
              L.lane('h', 'Конструктор', 'human'),
              L.lane('ui', 'Окно (app)', 'app'),
              L.lane('api', 'Командный слой (api)', 'app'),
              L.lane('fg', 'Плагин FrameGen', 'ext'),
              L.lane('core', 'Ядро модели (core)', 'app'),
              L.lane('st', 'Хранилище (store)', 'store'),
            ],
            steps: [
              L.phase('1. Выбор рёбер скелета и профиля через UI-разъём'),
              L.say('h', 'ui', 'Выбрать линии скелета и нажать «Профиль рамы»'),
              L.act('ui', 'Проверить affordances плагина через socket:ui-tool'),
              L.say('ui', 'api', 'Вызвать команду plugin.frame.generate { edges, profileId }'),
              L.phase('2. Чистая генерация деталей и сопряжений без мутации глобального состояния'),
              L.say('api', 'fg', 'Передать геометрию скелета и каталог ГОСТ-профилей'),
              L.act('fg', 'Рассчитать длины, подрезки торцов (углы 45°) и входы деталей'),
              L.back('fg', 'api', 'Вернуть чистый пакет { parts[], instances[], mates[] }'),
              L.phase('3. Проверка инвариантов ядра и запись черновика'),
              L.say('api', 'core', 'Провалидировать схему и пересчитать сборку (evaluate)'),
              L.back('core', 'api', 'Тела построены, пересечений нет (rev++)'),
              L.say('api', 'st', 'Сохранить черновик проекта { project, branch, rev }'),
              L.back('st', 'api', 'Черновик записан на диск (fsync)'),
              L.back('api', 'ui', 'Снимок сборки с ключом ревизии rev'),
              L.back('ui', 'h', 'Показать 3D-раму и обновить спецификацию'),
            ],
          }),
        },
        {
          id: 'proto-edit-part',
          module: 'app',
          scheme: L.sequence('Правка детали и защита от устаревшего ответа ядра (0036)', {
            lanes: [
              L.lane('h', 'Конструктор', 'human'),
              L.lane('nav', 'Автомат Nav (app)', 'app'),
              L.lane('api', 'Командный слой (api)', 'app'),
              L.lane('occt', 'Ядро OCCT (kernel)', 'ext'),
            ],
            steps: [
              L.say('h', 'nav', 'Изменить параметр или выдавить эскиз'),
              L.act('nav', 'apply(action): увеличить rev, записать запрос { key, rev }'),
              L.say('nav', 'api', 'part.build (key, rev)'),
              L.say('api', 'occt', 'Построить B-Rep в защищённом Scope'),
              L.back('occt', 'api', 'Сетка + отпечатки граней (или локальный FeatureError)'),
              L.back('api', 'nav', 'build-result { key, rev, report }'),
              L.alt('Ключ и ревизия ответа совпадают с текущим открытым?', [
                {
                  label: 'да, совпадают',
                  steps: [
                    L.act('nav', 'Записать report в состояние и перерисовать панели из Nav'),
                    L.back('nav', 'h', 'Обновить 3D-тело и дерево «Построение»'),
                  ],
                },
                {
                  label: 'нет, ответ устарел',
                  steps: [L.act('nav', 'Отбросить чужой ответ без перерисовки (INV-07)', 'stop')],
                  stop: true,
                },
              ]),
            ],
          }),
        },
      ],

      /* 8. Алгоритмы и правила решений (drakon-js) */
      algorithms: [
        {
          id: 'alg-apply-action',
          module: 'app',
          invariant: 'INV-07',
          scheme: D.silhouette(
            'Обработка действия окна apply(nav, action)',
            [
              {
                name: 'Проверка ревизии',
                items: [
                  D.shelf('Nav (window-state.ts)', 'Принять действие { type, modelRev }'),
                  D.q('Ревизия геометрии актуальна для действия?', {
                    no: [
                      D.act('Отбросить действие по устаревшей геометрии (no-op)', 'stop', 1),
                      D.go('Завершение'),
                    ],
                  }),
                  D.go('Допустимость'),
                ],
              },
              {
                name: 'Допустимость',
                items: [
                  D.act('Вычислить affordances(nav, model) тем же кодом, что для кнопок'),
                  D.q('Действие разрешено в текущем состоянии?', {
                    no: [
                      D.act('Сообщить причину отказа через refuse(why)', 'stop'),
                      D.go('Завершение'),
                    ],
                  }),
                  D.go('Переход и эффект'),
                ],
              },
              {
                name: 'Переход и эффект',
                items: [
                  D.act('Построить новый иммутабельный снимок Nav (modeOf вычисляется)'),
                  D.q('Обычная правка черновика (без выдачи PN)?', {
                    down: 'да, обычная',
                    right: 'нет, выпуск PN',
                    no: [D.ins('Продуктовый коммит и выдача PN', 'alg-product-commit')],
                  }),
                  D.act('Обновить интерфейс чистой функцией render(prev, next)', 'new'),
                  D.go('Завершение'),
                ],
              },
              {
                name: 'Завершение',
                items: [D.end('Готово')],
              },
            ],
            {
              notes: [
                'Между показом кнопки и кликом модель могла перестроиться — проверка modelRev защищает от выбора несуществующего ребра.',
              ],
            }
          ),
        },
        {
          id: 'alg-product-commit',
          module: 'store',
          invariant: 'INV-04',
          scheme: D.primitive(
            'Продуктовый коммит и выдача PN',
            [
              D.shelf('@keel/store', 'Прочитать текущую голову ветки main'),
              D.q('Все собственные детали имеют корректный материал и чертёж?', {
                no: [D.act('Вернуть список неготовности КД по деталям', 'stop'), D.go('@end')],
              }),
              D.act('Сверить constructionHash деталей с уже выпущенными ревизиями (0009)'),
              D.loop('Для каждой новой детали без PN', [
                D.act('Сформировать заводской номер (PN) по CompanyRules предприятия'),
              ]),
              D.act('Записать реестр PN и событие продуктового коммита одной транзакцией (fsync)', 'new', 1),
              D.end('PN присвоены'),
            ],
            {
              notes: [
                'Атомарная запись гарантирует, что при сбое питания номера PN не «сгорят» без коммита (INV-04).',
              ],
            }
          ),
        },
      ],
    }
  );
});
