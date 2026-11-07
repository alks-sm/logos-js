'use strict';
const assert = require('assert');
const path = require('path');
const Api = require('../../logos-api.js');

const unitDir = path.join(__dirname, 'units', 'core-flow');
const v = Api.verifyUnit({ unitDir });
console.log('=== ВЕРИФИКАЦИЯ МОДУЛЯ КОНТРОЛЛЕРА ШЛЮЗА (access-ctrl) ===');
console.log('Статус:', v.ok ? '✓ ОК' : '✗ ОШИБКА', '| Выполнено проверок контрактов и чистоты:', v.passedCount);
if (!v.ok) {
  console.error(v.issues);
  process.exit(1);
}

const unit = require('./units/core-flow/index.js');
for (const sc of unit.schema.scenarios) {
  const sim = Api.simulate({ unitDir, scenarioId: sc.id });
  console.log(`\n▶ ${sc.title}`);
  console.log(`  Шагов ДРАКОН: ${sim.trace.length} | Итоговый режим: mode="${sim.state.mode}", attempts=${sim.state.attempts}, siren=${sim.state.siren}, rev=${sim.state.rev}`);
  console.log(`  Команды портов: ${sim.effects.map((e) => e.port + '.' + e.call + ' -> ' + e.payload).join(' | ')}`);
}

// Автоматические инварианты поведения по всем 6 сценариям:
assert.strictEqual(Api.simulate({ unitDir, scenarioId: 'pin-ok-unlock' }).state.mode, 'unlocked');
assert.strictEqual(Api.simulate({ unitDir, scenarioId: 'third-wrong-pin-lockout' }).state.mode, 'lockout');
assert.strictEqual(Api.simulate({ unitDir, scenarioId: 'valid-pin-during-lockout' }).state.mode, 'lockout');
assert.strictEqual(Api.simulate({ unitDir, scenarioId: 'master-reset-from-lockout' }).state.mode, 'armed');
assert.strictEqual(Api.simulate({ unitDir, scenarioId: 'timeout-propped-door-alarm' }).state.mode, 'alarm');
assert.strictEqual(Api.simulate({ unitDir, scenarioId: 'forced-break-in-alarm' }).state.mode, 'alarm');

console.log('\n✓ Все 6 сценариев и 25 контрактных проверок контроллера шлюза пройдены успешно.');
