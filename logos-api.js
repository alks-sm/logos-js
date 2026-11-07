/* logos-api.js — Единый командный слой Logos (для CLI, MCP-сервера и веб-пульта).
   Принцип М11 («Проверка до записи»): любая мутация скелета или колбэка сначала проверяется
   Drakon.lint(), стражем чистоты (0 let/var/class/this/DOM) и контрактными тестами на deepFreeze. */
'use strict';

const fs = require('fs');
const path = require('path');
const Lg = require('./logos.js');
const Rt = require('./runtime.js');
const KeelModel = require('./examples/keel-model.js');

const PURITY_RULES = [
  { re: /\b(let|var)\s+[a-zA-Z0-9_$]+\s*=/, msg: 'Запрещена мутабельная переменная let/var в чистом колбэке' },
  { re: /\bclass\s+[A-Z]/, msg: 'Запрещены классы со скрытым состоянием' },
  { re: /\bthis\./, msg: 'Запрещено обращение к this' },
  { re: /\b(window|document|localStorage|sessionStorage)\./, msg: 'Запрещён прямой доступ к DOM/браузерным глобалам мимо портов (shelf)' },
];

function loadUnit(unitDir) {
  const absDir = path.resolve(unitDir);
  const indexFile = path.join(absDir, 'index.js');
  if (!fs.existsSync(indexFile)) {
    throw new Error(`В каталоге «${absDir}» не найден index.js модуля скелета.`);
  }
  // Очищаем кэш require, чтобы перечитывать свежие правки с диска
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(absDir)) delete require.cache[k];
  }
  const unit = require(indexFile);
  return { absDir, unit };
}

/* 1. Сводный статус модели и сверки с репозиторием */
function status(args) {
  const repoRoot = (args && args.repoRoot) || (KeelModel.repo && KeelModel.repo.root);
  const lintIssues = Lg.lint(KeelModel);
  const verify = Lg.verifyRepo(KeelModel, repoRoot);
  return {
    ok: lintIssues.filter((i) => i.level === 'error').length === 0 && verify.findings.filter((f) => f.level === 'error').length === 0,
    project: KeelModel.title,
    lintIssues,
    verifyStats: verify.stats,
    findings: verify.findings,
    checksPassed: verify.checks.length,
    reportText: Lg.report(KeelModel, repoRoot),
  };
}

/* 2. Верификация модуля «Скелет + Колбэки» (1-schema + 2-plan + 3-contracts + impl/*) */
function verifyUnit(args) {
  const unitDir = (args && args.unitDir) || path.join(__dirname, 'examples', 'nav-skeleton');
  const { absDir, unit } = loadUnit(unitDir);
  const drakonIssues = [];
  for (const [name, scheme] of Object.entries((unit.plan && unit.plan.schemes) || {})) {
    for (const di of Lg.Drakon.lint(scheme)) {
      drakonIssues.push({ level: di.level, where: `drakon:${name} › ${di.where}`, message: di.message });
    }
  }
  const skel = Rt.verifySkeleton(unit, path.join(absDir, 'impl'));
  const allIssues = drakonIssues.concat(skel.issues);

  const slots = (unit.contracts || []).map((c) => {
    const slotErrs = skel.issues.filter((i) => i.where.startsWith(`contract:${c.id}`) || i.where === `impl:${c.id}`);
    return {
      id: c.id,
      kind: c.kind,
      port: c.port || null,
      title: c.title,
      reads: c.reads || [],
      writes: c.writes || [],
      casesCount: (c.cases || []).length,
      status: slotErrs.length === 0 ? 'ready' : 'error',
      errors: slotErrs.map((e) => e.message),
    };
  });

  return {
    ok: allIssues.filter((i) => i.level === 'error').length === 0,
    unitId: unit.id,
    title: unit.title,
    passedCount: skel.passed.length,
    issues: allIssues,
    slots,
  };
}

/* 3. Выгрузка изолированного микро-ТЗ на один колбэк (для дешёвой модели без показа остальной системы) */
function slotBrief(args) {
  const unitDir = (args && args.unitDir) || path.join(__dirname, 'examples', 'nav-skeleton');
  const slotId = args && args.slotId;
  const { unit } = loadUnit(unitDir);
  const c = (unit.contracts || []).find((x) => x.id === slotId);
  if (!c) throw new Error(`Контракт колбэка «${slotId}» не найден в модуле «${unit.id}».`);

  const lines = [
    `# ИЗОЛИРОВАННОЕ ТЗ НА КОЛБЭК «${c.id}» (Модуль: ${unit.title})`,
    `Тип гнезда: \`${c.kind}\`${c.port ? ` (порт: \`${c.port}\`)` : ''}`,
    `Назначение: ${c.title}`,
    `Разрешено читать (reads): ${(c.reads || []).map((r) => '`' + r + '`').join(', ') || 'state, bag, world'}`,
    `Обязано вернуть (writes): ${(c.writes || []).map((w) => '`' + w + '`').join(', ') || (c.kind === 'guard' ? 'boolean | string' : 'string | object')}`,
    ``,
    `## Жёсткие ограничения (проверяются до записи М11):`,
    `- Входные аргументы \`(state, bag, world)\` глубоко заморожены (\`Object.freeze\`). Любая мутация входа бросит TypeError.`,
    `- Запрещены \`let\`, \`var\`, \`class\`, \`this\`, \`window\`, \`document\`. Только чистая функция.`,
    ``,
    `## Обязательные тест-кейсы контракта (${(c.cases || []).length} шт.):`,
  ];
  (c.cases || []).forEach((tc, i) => {
    lines.push(
      `${i + 1}. **${tc.title || 'Кейс ' + (i + 1)}**: вход \`state=${JSON.stringify(tc.state)}\`, \`bag=${JSON.stringify(tc.bag || {})}\` → ожидание: \`${tc.expect !== undefined ? JSON.stringify(tc.expect) : 'проверка check(res)'}\``
    );
  });
  return lines.join('\n');
}

/* 4. Проверка кандидата-колбэка ДО записи (М11: чистота + deepFreeze + контрактные тесты) */
function checkSlotCandidate(args) {
  const unitDir = (args && args.unitDir) || path.join(__dirname, 'examples', 'nav-skeleton');
  const slotId = args && args.slotId;
  const fnCode = args && args.fnCode;
  const { unit } = loadUnit(unitDir);
  const c = (unit.contracts || []).find((x) => x.id === slotId);
  if (!c) throw new Error(`Контракт колбэка «${slotId}» не найден.`);

  // А. Проверка чистоты кода по строкам
  for (const rule of PURITY_RULES) {
    if (rule.re.test(fnCode)) {
      return { ok: false, error: `Нарушение стража чистоты: ${rule.msg}` };
    }
  }

  // Б. Компиляция функции в изоляции
  let fn;
  try {
    fn = new Function('return (' + fnCode.trim() + ')')();
  } catch (e) {
    return { ok: false, error: `Синтаксическая ошибка в коде колбэка: ${e.message}` };
  }
  if (typeof fn !== 'function') {
    return { ok: false, error: 'Код должен возвращать функцию (state, bag, world) => ...' };
  }

  // В. Прогон всех контрактных тестов на замороженных данных
  for (let i = 0; i < (c.cases || []).length; i++) {
    const tc = c.cases[i];
    try {
      const st = Rt.deepFreeze(JSON.parse(JSON.stringify(tc.state !== undefined ? tc.state : unit.schema.initialState)));
      const bg = Rt.deepFreeze(JSON.parse(JSON.stringify(tc.bag || {})));
      const wr = Rt.deepFreeze(JSON.parse(JSON.stringify(tc.world || {})));
      const actual = fn(st, bg, wr);
      const passed = tc.check ? tc.check(actual, st, bg) : JSON.stringify(actual) === JSON.stringify(tc.expect);
      if (!passed) {
        return {
          ok: false,
          error: `Провален контрактный тест #${i + 1} («${tc.title}»): получено ${JSON.stringify(actual)}`,
        };
      }
    } catch (e) {
      return {
        ok: false,
        error: `Исключение на тесте #${i + 1} («${tc.title}»): ${e.message}`,
      };
    }
  }

  return { ok: true, passedCases: (c.cases || []).length };
}

/* 5. Прогон сценария через исполняемую схему ДРАКОН (Logos.Runtime.run) */
function simulate(args) {
  const unitDir = (args && args.unitDir) || path.join(__dirname, 'examples', 'nav-skeleton');
  const { unit } = loadUnit(unitDir);
  const schemeName = (args && args.scheme) || Object.keys(unit.plan.schemes)[0];
  const scheme = unit.plan.schemes[schemeName];
  if (!scheme) throw new Error(`Схема «${schemeName}» не найдена в 2-plan.js.`);

  const sc =
    (args && args.scenarioId && (unit.schema.scenarios || []).find((s) => s.id === args.scenarioId)) ||
    (unit.schema.scenarios && unit.schema.scenarios[0]) || {
      state: unit.schema.initialState,
      bag: (args && args.bag) || {},
      world: (args && args.world) || {},
    };

  const state = (args && args.state) || sc.state;
  const bag = (args && args.bag) || sc.bag;
  const world = (args && args.world) || sc.world;

  const res = Rt.run(scheme, unit.impl, state, bag, world);
  return {
    scenario: sc.title || sc.id || 'custom',
    outcome: res.outcome,
    trace: res.trace,
    state: res.state,
    bag: res.bag,
    effects: res.effects,
  };
}

/* 6. Генератор канонического скелета проекта с нуля (scaffoldProject) */
function scaffoldProject(args) {
  if (!args || !args.targetDir || !args.id) {
    throw new Error('Для scaffoldProject требуются { targetDir, id, title? }.');
  }
  const targetDir = path.resolve(args.targetDir);
  const id = args.id;
  const title = args.title || id;
  const summary = args.summary || `Проект «${title}» на исполняемом скелете Logos`;

  const unitDir = path.join(targetDir, 'units', 'core-flow');
  const implDir = path.join(unitDir, 'impl');
  fs.mkdirSync(implDir, { recursive: true });

  // 1. package.json
  fs.writeFileSync(
    path.join(targetDir, 'package.json'),
    JSON.stringify(
      {
        name: id,
        version: '0.1.0',
        private: true,
        description: summary,
        scripts: {
          test: 'node test.js',
        },
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  // 2. units/core-flow/1-schema.js
  fs.writeFileSync(
    path.join(unitDir, '1-schema.js'),
    `'use strict';\nmodule.exports = {\n  initialState: { status: 'idle', items: [], rev: 1 },\n  derived: {\n    isEmpty: (state) => state.items.length === 0,\n  },\n  scenarios: [\n    {\n      id: 'add-valid-item',\n      title: '1. Добавление корректного элемента',\n      state: { status: 'idle', items: [], rev: 1 },\n      bag: { input: { name: 'Деталь А' } },\n      world: {},\n    },\n    {\n      id: 'reject-empty-name',\n      title: '2. Отказ при пустом имени элемента',\n      state: { status: 'idle', items: [], rev: 1 },\n      bag: { input: { name: '' } },\n      world: {},\n    },\n  ],\n};\n`,
    'utf8'
  );

  // 3. units/core-flow/2-plan.js
  const logosRel = path.relative(unitDir, __dirname).replace(/\\/g, '/');
  fs.writeFileSync(
    path.join(unitDir, '2-plan.js'),
    `'use strict';\nconst D = require('${logosRel}/vendor/drakon.js');\n\nconst handleCommand = D.primitive('${title}: обработка команды', [\n  D.q('Входные данные заполнены?', {\n    call: 'isInputValid',\n    no: [\n      D.shelf('ui', 'Сообщить об ошибке ввода', { k: 'stop', call: 'notifyInvalid' }),\n      D.go('@end'),\n    ],\n  }),\n  D.act('Добавить элемент в иммутабельный список и увеличить rev', { k: 'new', call: 'appendItem' }),\n  D.shelf('ui', 'Обновить экран по новому состоянию', { call: 'renderState' }),\n  D.end('Выполнено'),\n]);\n\nmodule.exports = { schemes: { handleCommand } };\n`,
    'utf8'
  );

  // 4. units/core-flow/3-contracts.js
  fs.writeFileSync(
    path.join(unitDir, '3-contracts.js'),
    `'use strict';\nmodule.exports = [\n  {\n    id: 'isInputValid',\n    kind: 'guard',\n    title: 'Проверка непустого имени во входном пакете',\n    reads: ['bag.input.name'],\n    cases: [\n      { title: 'непустое имя — true', bag: { input: { name: 'Вал' } }, expect: true },\n      { title: 'пустое имя — false', bag: { input: { name: '   ' } }, expect: false },\n    ],\n  },\n  {\n    id: 'appendItem',\n    kind: 'step',\n    title: 'Добавление элемента в список items и инкремент rev',\n    writes: ['state.items', 'state.rev'],\n    cases: [\n      {\n        title: 'добавляет элемент и увеличивает rev',\n        state: { status: 'idle', items: [], rev: 1 },\n        bag: { input: { name: 'Вал' } },\n        check: (res) => res.state.items.length === 1 && res.state.rev === 2,\n      },\n    ],\n  },\n  {\n    id: 'notifyInvalid',\n    kind: 'port',\n    port: 'ui',\n    title: 'Уведомление об отказе ввода',\n    cases: [{ title: 'текст отказа', expect: 'Отказ: укажите непустое имя' }],\n  },\n  {\n    id: 'renderState',\n    kind: 'port',\n    port: 'ui',\n    title: 'Отрисовка обновлённого состояния',\n    cases: [\n      {\n        title: 'строка рендера',\n        state: { items: ['Вал'], rev: 2 },\n        expect: 'render(items=1, rev=2)',\n      },\n    ],\n  },\n];\n`,
    'utf8'
  );

  // 5. units/core-flow/impl/{guards,steps,ports}.js
  fs.writeFileSync(
    path.join(implDir, 'guards.js'),
    `'use strict';\nmodule.exports = {\n  isInputValid: (_state, bag) => Boolean(bag.input && typeof bag.input.name === 'string' && bag.input.name.trim().length > 0),\n};\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(implDir, 'steps.js'),
    `'use strict';\nmodule.exports = {\n  appendItem: (state, bag) => ({\n    state: Object.assign({}, state, {\n      status: 'ready',\n      items: state.items.concat([bag.input.name.trim()]),\n      rev: state.rev + 1,\n    }),\n  }),\n};\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(implDir, 'ports.js'),
    `'use strict';\nmodule.exports = {\n  ui: {\n    notifyInvalid: () => 'Отказ: укажите непустое имя',\n    renderState: (state) => \`render(items=\${state.items.length}, rev=\${state.rev})\`,\n  },\n};\n`,
    'utf8'
  );

  // 6. units/core-flow/index.js
  fs.writeFileSync(
    path.join(unitDir, 'index.js'),
    `'use strict';\nmodule.exports = {\n  id: 'core-flow',\n  title: '${title} — основной поток',\n  schema: require('./1-schema.js'),\n  plan: require('./2-plan.js'),\n  contracts: require('./3-contracts.js'),\n  impl: {\n    guards: require('./impl/guards.js'),\n    steps: require('./impl/steps.js'),\n    ports: require('./impl/ports.js'),\n  },\n};\n`,
    'utf8'
  );

  // 7. test.js
  const rootLogosRel = path.relative(targetDir, __dirname).replace(/\\/g, '/');
  fs.writeFileSync(
    path.join(targetDir, 'test.js'),
    `'use strict';\nconst assert = require('assert');\nconst path = require('path');\nconst Api = require('${rootLogosRel}/logos-api.js');\n\nconst unitDir = path.join(__dirname, 'units', 'core-flow');\nconst v = Api.verifyUnit({ unitDir });\nconsole.log('Верификация скелета:', v.ok ? '✓ ОК' : '✗ ОШИБКА', '| Проверок:', v.passedCount);\nif (!v.ok) {\n  console.error(v.issues);\n  process.exit(1);\n}\nconst sim1 = Api.simulate({ unitDir, scenarioId: 'add-valid-item' });\nassert.strictEqual(sim1.state.items.length, 1);\nconst sim2 = Api.simulate({ unitDir, scenarioId: 'reject-empty-name' });\nassert.strictEqual(sim2.state.items.length, 0);\nconsole.log('✓ Все сценарии и контракты выполнены без ошибок.');\n`,
    'utf8'
  );

  return {
    ok: true,
    targetDir,
    unitDir,
    filesCreated: [
      'package.json',
      'test.js',
      'units/core-flow/1-schema.js',
      'units/core-flow/2-plan.js',
      'units/core-flow/3-contracts.js',
      'units/core-flow/impl/guards.js',
      'units/core-flow/impl/steps.js',
      'units/core-flow/impl/ports.js',
      'units/core-flow/index.js',
    ],
  };
}

module.exports = {
  status,
  verifyUnit,
  slotBrief,
  checkSlotCandidate,
  simulate,
  scaffoldProject,
};
