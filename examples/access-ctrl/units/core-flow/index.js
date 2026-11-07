/* index.js — Сборка модуля контроллера шлюза безопасности (для Node и для браузерного пульта Logos). */
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
    root.AccessCtrlUnit = factory(
      root.AccessSchema,
      root.AccessPlan,
      root.AccessContracts,
      root.AccessImplGuards,
      root.AccessImplSteps,
      root.AccessImplPorts
    );
  }
})(typeof self !== 'undefined' ? self : this, function (schema, plan, contracts, guards, steps, ports) {
  'use strict';
  return {
    id: 'access-ctrl',
    title: 'Смарт-контроллер доступа (5 режимов, аварийный контур, блокировка PIN)',
    schema,
    plan,
    contracts,
    impl: { guards, steps, ports },
  };
});
