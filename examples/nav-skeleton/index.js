/* index.js — Сборка эталонного модуля «Скелет + Колбэки» (1-schema + 2-plan + 3-contracts + impl/*). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./1-schema.js'),
      require('./2-plan.js'),
      require('./3-contracts.js'),
      require('./impl/guards.js'),
      require('./impl/steps.js'),
      require('./impl/ports.js')
    );
  } else {
    root.NavSkeletonUnit = factory(
      root.NavSchema,
      root.NavPlan,
      root.NavContracts,
      root.NavImplGuards,
      root.NavImplSteps,
      root.NavImplPorts
    );
  }
})(typeof self !== 'undefined' ? self : this, function (schema, plan, contracts, guards, steps, ports) {
  'use strict';
  return {
    id: 'nav-skeleton',
    title: 'Диспетчер навигации и вкладок окна (Решение 0036)',
    filesLayout: [
      { path: '1-schema.js', role: 'Структуры данных (State, Bag) и вычисляемые проекции (modeOf, whyNotDrawing)' },
      { path: '2-plan.js', role: 'Скелет на языке ДРАКОН: силуэт из 3 веток с привязками { call } без императивного кода' },
      { path: '3-contracts.js', role: '15 контрактов колбэков с входами/выходами и изолированными тест-кейсами (cases)' },
      { path: 'impl/guards.js', role: '4 чистых предиката для вопросов D.q и D.choice (0 let/var/class/DOM)' },
      { path: 'impl/steps.js', role: '6 чистых шагов перехода данных для икон D.act (работают на замороженном State)' },
      { path: 'impl/ports.js', role: '5 адаптеров внешних эффектов для полок D.shelf (ui, api)' },
    ],
    schema,
    plan,
    contracts,
    impl: { guards, steps, ports },
  };
});
