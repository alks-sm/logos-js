/* Logos.Runtime 1.0 — исполняемое ядро («Скелет + Чистые колбэки»).
   Движок читает схему ДРАКОН как план исполнения, передаёт в колбэки глубоко замороженные данные
   (deepFreeze — скрытая мутация физически невозможна), разделяет чистые проверки (q/choice -> guards),
   чистые переходы данных (act -> steps) и внешние порты (shelf -> ports), возвращает полную трассу
   пройденного маршрута (trace) для подсветки на SVG и проверяет контракты всех колбэков. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const fs = require('fs');
    const path = require('path');
    module.exports = factory(fs, path);
  } else {
    root.LogosRuntime = factory(null, null);
    if (root.Logos) root.Logos.Runtime = root.LogosRuntime;
  }
})(typeof self !== 'undefined' ? self : this, function (fs, path) {
  'use strict';

  /* ── 1. Глубокая заморозка данных: защита от скрытых мутаций по построению ── */

  function deepFreeze(obj) {
    if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) return obj;
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      deepFreeze(obj[key]);
    }
    return obj;
  }

  function cloneAndFreeze(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    return deepFreeze(JSON.parse(JSON.stringify(obj)));
  }

  /* ── 2. Сбор всех точек привязки колбэков (call) из схемы ДРАКОН ──────────── */

  function collectSchemeBindings(scheme) {
    const bindings = [];

    function walk(items, wherePrefix) {
      if (!Array.isArray(items)) return;
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        const at = wherePrefix ? `${wherePrefix} › ${it.text || it.to || it.t}` : (it.text || it.to || it.t);
        if (it.t === 'q') {
          bindings.push({ where: at, iconType: 'q', slotKind: 'guard', call: it.call || null, text: it.text });
          walk(it.yes || [], at);
          walk(it.no || [], at);
        } else if (it.t === 'choice') {
          bindings.push({ where: at, iconType: 'choice', slotKind: 'guard', call: it.call || null, text: it.text });
          for (const c of it.cases || []) walk(c.seq || [], `${at} › ${c.label}`);
        } else if (it.t === 'act') {
          bindings.push({ where: at, iconType: 'act', slotKind: 'step', call: it.call || null, text: it.text });
        } else if (it.t === 'shelf') {
          bindings.push({
            where: at,
            iconType: 'shelf',
            slotKind: 'port',
            port: it.who,
            call: it.call || null,
            text: `${it.who}: ${it.text}`,
          });
        } else if (it.t === 'loop') {
          bindings.push({ where: at, iconType: 'loop', slotKind: 'guard', call: it.call || null, text: it.text });
          walk(it.body || [], at);
        }
      }
    }

    if (scheme.kind === 'primitive') {
      walk(scheme.items, scheme.title);
    } else if (scheme.kind === 'silhouette') {
      for (const b of scheme.branches || []) walk(b.items, b.name);
    }
    return bindings;
  }

  /* ── 3. Исполнитель схемы ДРАКОН (Драйвер скелета) ────────────────────────── */

  function run(scheme, impl, initialState, initialBag, world, opts) {
    const maxSteps = (opts && opts.maxSteps) || 200;
    const guards = (impl && impl.guards) || {};
    const steps = (impl && impl.steps) || {};
    const ports = (impl && impl.ports) || {};

    let state = cloneAndFreeze(initialState || {});
    let bag = cloneAndFreeze(initialBag || {});
    const frozenWorld = deepFreeze(Object.assign({}, world || {}));
    const effects = [];
    const trace = [];
    let stepCount = 0;

    function tick(where, iconType, call, detail, beforeState, newEffect) {
      stepCount++;
      if (stepCount > maxSteps) {
        throw new Error(`Logos.Runtime: превышен предел шагов (${maxSteps}) на узле «${where}» (бесконечный цикл).`);
      }
      trace.push({
        step: stepCount,
        where,
        iconType,
        call: call || null,
        detail,
        beforeState: beforeState || state,
        afterState: state,
        bag,
        effect: newEffect || null,
        effects: effects.slice(),
      });
    }

    function execSeq(items, wherePrefix) {
      for (const it of items) {
        const at = wherePrefix ? `${wherePrefix} › ${it.text || it.to || it.t}` : (it.text || it.to || it.t);

        if (it.t === 'goto') {
          tick(at, 'goto', null, `→ ${it.to}`, state, null);
          return { jump: it.to };
        }
        if (it.t === 'end') {
          tick(at, 'end', null, it.text || 'Конец', state, null);
          return { end: it.text || 'Конец' };
        }

        if (it.t === 'act') {
          if (!it.call) throw new Error(`Logos.Runtime: у иконы act «${at}» не указан колбэк (call).`);
          const fn = steps[it.call];
          if (typeof fn !== 'function') throw new Error(`Logos.Runtime: не найден чистый шаг steps.${it.call} для «${at}».`);
          const prevSt = state;
          const res = fn(state, bag, frozenWorld);
          if (res && typeof res === 'object') {
            if ('state' in res && res.state !== undefined) state = cloneAndFreeze(res.state);
            if ('bag' in res && res.bag !== undefined) bag = cloneAndFreeze(Object.assign({}, bag, res.bag));
          }
          tick(at, 'act', it.call, res && res.note ? res.note : 'выполнено', prevSt, null);
          continue;
        }

        if (it.t === 'shelf') {
          if (!it.call) throw new Error(`Logos.Runtime: у полки shelf «${at}» не указан колбэк порта (call).`);
          const portObj = ports[it.who];
          const fn = portObj && portObj[it.call];
          if (typeof fn !== 'function') {
            throw new Error(`Logos.Runtime: не найден метод порта ports["${it.who}"].${it.call} для «${at}».`);
          }
          const prevSt = state;
          const eff = fn(state, bag, frozenWorld);
          const effEntry = eff !== undefined ? { port: it.who, call: it.call, payload: eff } : null;
          if (effEntry) effects.push(effEntry);
          tick(at, 'shelf', `${it.who}.${it.call}`, typeof eff === 'string' ? eff : JSON.stringify(eff), prevSt, effEntry);
          continue;
        }

        if (it.t === 'q') {
          if (!it.call) throw new Error(`Logos.Runtime: у вопроса q «${at}» не указан предикат (call).`);
          const fn = guards[it.call];
          if (typeof fn !== 'function') throw new Error(`Logos.Runtime: не найден предикат guards.${it.call} для «${at}».`);
          const ok = Boolean(fn(state, bag, frozenWorld));
          const downLbl = it.down || 'да';
          const rightLbl = it.right || 'нет';
          tick(at, 'q', it.call, ok ? downLbl : rightLbl, state, null);

          if (ok) {
            if (it.yes && it.yes.length > 0) {
              const r = execSeq(it.yes, at);
              if (r) return r;
            }
          } else {
            if (it.no && it.no.length > 0) {
              const r = execSeq(it.no, at);
              if (r) return r;
            }
          }
          continue;
        }

        if (it.t === 'choice') {
          if (!it.call) throw new Error(`Logos.Runtime: у выбора choice «${at}» не указан селектор (call).`);
          const fn = guards[it.call];
          if (typeof fn !== 'function') throw new Error(`Logos.Runtime: не найден селектор guards.${it.call} для «${at}».`);
          const chosenLabel = String(fn(state, bag, frozenWorld));
          const foundCase = (it.cases || []).find((c) => c.label === chosenLabel) || (it.cases || [])[it.cases.length - 1];
          if (!foundCase) throw new Error(`Logos.Runtime: в выборе «${at}» нет варианта для «${chosenLabel}».`);
          tick(at, 'choice', it.call, foundCase.label, state, null);
          const caseAt = `${at} › ${foundCase.label}`;
          tick(caseAt, 'case', null, foundCase.label, state, null);
          const r = execSeq(foundCase.seq || [], caseAt);
          if (r) return r;
          continue;
        }

        if (it.t === 'loop') {
          if (!it.call) throw new Error(`Logos.Runtime: у цикла loop «${at}» не указан источник списка (call).`);
          const fn = guards[it.call];
          if (typeof fn !== 'function') throw new Error(`Logos.Runtime: не найден итератор guards.${it.call} для «${at}».`);
          const list = fn(state, bag, frozenWorld) || [];
          tick(at, 'loop', it.call, `элементов: ${list.length}`, state, null);
          for (let idx = 0; idx < list.length; idx++) {
            bag = cloneAndFreeze(Object.assign({}, bag, { loopItem: list[idx], loopIndex: idx }));
            const r = execSeq(it.body || [], at);
            if (r) return r;
          }
          continue;
        }
      }
      return null;
    }

    let outcome = 'Конец';
    if (scheme.kind === 'primitive') {
      const r = execSeq(scheme.items || [], scheme.title);
      if (r && r.end) outcome = r.end;
    } else if (scheme.kind === 'silhouette') {
      const branchMap = new Map((scheme.branches || []).map((b) => [b.name, b]));
      let curBranch = scheme.branches && scheme.branches[0];
      while (curBranch) {
        tick(curBranch.name, 'branch', null, `Ветка «${curBranch.name}»`, state, null);
        const r = execSeq(curBranch.items || [], curBranch.name);
        if (!r || r.end) {
          outcome = (r && r.end) || 'Конец';
          break;
        }
        if (r.jump) {
          const nextB = branchMap.get(r.jump);
          if (!nextB) throw new Error(`Logos.Runtime: переход go("${r.jump}") ведёт на несуществующую ветку.`);
          curBranch = nextB;
        }
      }
    }

    return { state, bag, effects, trace, outcome };
  }

  /* ── 4. Полная верификация скелета, контрактов, изолированных тестов и чистоты impl/ ─ */

  function verifySkeleton(unit, implDir) {
    const issues = [];
    const passed = [];
    const pushErr = (where, message) => issues.push({ level: 'error', where, message });
    const pushOk = (where, detail) => passed.push({ where, detail });

    const { schema, plan, contracts, impl } = unit;
    const contractMap = new Map();
    for (const c of contracts || []) {
      if (contractMap.has(c.id)) pushErr(`contract:${c.id}`, `Дублирующийся контракт колбэка «${c.id}».`);
      contractMap.set(c.id, c);
    }

    // А. Все ли иконы во всех схемах плана привязаны к контрактам?
    for (const [planKey, scheme] of Object.entries(plan.schemes || {})) {
      const bindings = collectSchemeBindings(scheme);
      for (const b of bindings) {
        if (!b.call) {
          pushErr(`plan:${planKey} › ${b.where}`, `Икона (${b.iconType}) не привязана к колбэку (отсутствует поле call).`);
          continue;
        }
        const c = contractMap.get(b.call);
        if (!c) {
          pushErr(`plan:${planKey} › ${b.where}`, `Икона ссылается на необъявленный контракт колбэка «${b.call}».`);
          continue;
        }
        if (c.kind !== b.slotKind) {
          pushErr(
            `plan:${planKey} › ${b.where}`,
            `Несовпадение роли колбэка «${b.call}»: икона ${b.iconType} требует «${b.slotKind}», а в контракте указано «${c.kind}».`
          );
        }
      }
      pushOk(`plan:${planKey}`, `Схема «${scheme.title}»: все ${bindings.length} икон привязаны к контрактам`);
    }

    // Б. Проверка наличия реализаций и прогон изолированных тестовых примеров (cases) каждого контракта
    for (const c of contracts || []) {
      let fn = null;
      if (c.kind === 'guard') fn = impl.guards && impl.guards[c.id];
      else if (c.kind === 'step') fn = impl.steps && impl.steps[c.id];
      else if (c.kind === 'port') fn = impl.ports && c.port && impl.ports[c.port] && impl.ports[c.port][c.id];

      if (typeof fn !== 'function') {
        pushErr(`impl:${c.id}`, `Отсутствует реализация колбэка «${c.id}» (${c.kind}) в модуле impl.`);
        continue;
      }

      if (!c.cases || c.cases.length === 0) {
        pushErr(`contract:${c.id}`, `У контракта колбэка «${c.id}» нет ни одного проверочного примера (cases).`);
        continue;
      }

      let casesOk = 0;
      c.cases.forEach((tc, idx) => {
        try {
          const st = cloneAndFreeze(tc.state !== undefined ? tc.state : schema.initialState);
          const bg = cloneAndFreeze(tc.bag || {});
          const wr = cloneAndFreeze(tc.world || {});
          const actual = fn(st, bg, wr);
          const ok = tc.check ? tc.check(actual, st, bg) : JSON.stringify(actual) === JSON.stringify(tc.expect);
          if (!ok) {
            pushErr(
              `contract:${c.id}#${idx + 1}`,
              `Провален тест контракта «${tc.title || idx + 1}»: ожидалось ${JSON.stringify(tc.expect)}, получено ${JSON.stringify(actual)}.`
            );
          } else {
            casesOk++;
          }
        } catch (e) {
          pushErr(`contract:${c.id}#${idx + 1}`, `Исключение в колбэке «${c.id}» (возможно, попытка скрытой мутации!): ${e.message}`);
        }
      });

      if (casesOk === c.cases.length) {
        pushOk(`contract:${c.id}`, `[${c.kind}] «${c.title}» — ${casesOk}/${c.cases.length} контрактных тестов ОК`);
      }
    }

    // В. Страж запрета на скрытые состояния в файлах impl/ (если запущено в Node)
    if (fs && path && implDir && fs.existsSync(implDir)) {
      const files = fs.readdirSync(implDir).filter((f) => f.endsWith('.js') || f.endsWith('.ts'));
      const forbidden = [
        { re: /\b(let|var)\s+[a-zA-Z0-9_$]+\s*=/, msg: 'Запрещена мутабельная переменная let/var в модуле чистых колбэков' },
        { re: /\bclass\s+[A-Z]/, msg: 'Запрещены классы со скрытым состоянием внутри impl/' },
        { re: /\bthis\./, msg: 'Запрещено обращение к this внутри чистых колбэков impl/' },
        { re: /\b(window|document|localStorage|sessionStorage)\./, msg: 'Запрещён прямой доступ к браузерным глобалам мимо портов (shelf)' },
      ];
      for (const file of files) {
        const full = path.join(implDir, file);
        const lines = fs.readFileSync(full, 'utf8').split('\n');
        let fileClean = true;
        lines.forEach((line, i) => {
          const t = line.trim();
          if (t.startsWith('//') || t.startsWith('*')) return;
          for (const rule of forbidden) {
            if (rule.re.test(line)) {
              fileClean = false;
              pushErr(`purity:impl/${file}:${i + 1}`, `${rule.msg}: «${t}»`);
            }
          }
        });
        if (fileClean) {
          pushOk(`purity:impl/${file}`, `Файл чистых колбэков проверен: 0 скрытых состояний (нет let/var/class/this/DOM)`);
        }
      }
    }

    return { ok: issues.length === 0, issues, passed };
  }

  return {
    deepFreeze,
    collectSchemeBindings,
    run,
    verifySkeleton,
  };
});
