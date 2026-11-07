const assert = require('assert');
const Lg = require('./logos.js');
const KeelModel = require('./examples/keel-model.js');

console.log('=== 1. Отчёт Logos по эталонной модели Keel ===\n');
console.log(Lg.report(KeelModel));

const issues = Lg.lint(KeelModel);
const errors = issues.filter((i) => i.level === 'error');
const warns = issues.filter((i) => i.level === 'warn');

assert.strictEqual(errors.length, 0, 'В эталонной модели Keel не должно быть ошибок (error)');
assert.strictEqual(
  warns.length,
  1,
  'Должно быть ровно 1 намеренное предупреждение по INV-08 (отсутствует guard для реестра плагинов)'
);
assert.ok(warns[0].where.includes('INV-08'));

// Проверка генерации SVG
const layersSvg = Lg.layersSvg(KeelModel);
const statesSvg = Lg.statesSvg(KeelModel);
assert.ok(layersSvg.startsWith('<svg') && layersSvg.includes('socket:feature'));
assert.ok(statesSvg.startsWith('<svg') && statesSvg.includes('Открыть вкладку «Чертёж»'));

// Проверка негативных сценариев (способность Logos ловить нарушения)
const brokenModel = Lg.project(
  { id: 'broken', title: 'Нарушенная архитектура' },
  {
    decisions: [Lg.decision('D1', 'Решение', 'Правило')],
    invariants: [Lg.invariant('I1', 'Инвариант с битым решением', 'D999', { guard: 'test' })],
    modules: [
      Lg.moduleDef('low', 'Нижний', 0, { deps: ['high'] }), // пробой слоя снизу вверх!
      Lg.moduleDef('high', 'Верхний', 2, { deps: [] }),
    ],
    states: [
      Lg.state('s1', 'Старт', { initial: true }),
      Lg.state('s2', 'Остров', {}), // недостижимое и тупиковое состояние
    ],
    transitions: [Lg.transition('s1', 'В себя', 's1')],
  }
);

const brokenIssues = Lg.lint(brokenModel);
assert.ok(brokenIssues.some((i) => i.message.includes('Пробой архитектуры слоёв')));
assert.ok(brokenIssues.some((i) => i.message.includes('недостижимо из начального')));
assert.ok(brokenIssues.some((i) => i.message.includes('неизвестное решение')));

console.log('\n=== 2. Пример выгрузки ТЗ (прошивки) для ИИ по модулю core ===\n');
console.log(Lg.brief(KeelModel, 'core'));
console.log('\n✓ Все тесты ядра Logos пройдены успешно.');
