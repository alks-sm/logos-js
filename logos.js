/* Logos 1.2 — фреймворк кристаллизации архитектуры:
   формальная база инвариантов, границ модулей, файловой структуры, состояний и схем (ДРАКОН + Дорожки)
   со сквозной проверкой модели (Logos.lint), автоматической сверкой с живым репозиторием (Logos.verifyRepo),
   интерактивными SVG-схемами и генерацией ТЗ/вердиктов для ИИ-агентов (Logos.brief, Logos.judge).
   Работает в браузере (глобальный Logos, в т.ч. с file://) и в Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const D = require('./vendor/drakon.js');
    const L = require('./vendor/lanes.js');
    const fs = require('fs');
    const path = require('path');
    module.exports = factory(D, L, fs, path);
  } else {
    root.Logos = factory(root.Drakon, root.Lanes, null, null);
  }
})(typeof self !== 'undefined' ? self : this, function (Drakon, Lanes, fs, path) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getIssuesFor(issues, id) {
    return (issues || []).filter((i) => i.where.includes(id));
  }

  /* ── Конструкторы записей базы Logos ───────────────────────────────────────── */

  function term(id, title, meaning, opts) {
    return Object.assign({ kind: 'term', id, title, meaning }, opts || {});
  }

  function decision(id, title, rule, opts) {
    return Object.assign(
      { kind: 'decision', id, title, status: 'accepted', rule, file: (opts && opts.file) || null },
      opts || {}
    );
  }

  function invariant(id, title, decisionId, opts) {
    const o = opts || {};
    return {
      kind: 'invariant',
      id,
      title,
      decision: decisionId,
      why: o.why || '',
      guard: o.guard || null,
      scope: o.scope || [],
      rules: o.rules || [],
    };
  }

  function moduleDef(id, title, layer, opts) {
    const o = opts || {};
    return {
      kind: 'module',
      id,
      title,
      layer,
      layerName: o.layerName || `Слой ${layer}`,
      role: o.role || '',
      pkg: o.pkg || `@keel/${id}`,
      path: o.path || `packages/${id}`,
      files: o.files || [],
      deps: o.deps || [],
      testDeps: o.testDeps || [],
      actorKind: o.actorKind || 'app',
    };
  }

  function socket(id, title, hostModule, opts) {
    const o = opts || {};
    return {
      kind: 'socket',
      id,
      title,
      host: hostModule,
      contract: o.contract || '',
      invariants: o.invariants || [],
      examples: o.examples || [],
    };
  }

  function state(id, title, opts) {
    const o = opts || {};
    return {
      kind: 'state',
      id,
      title,
      initial: Boolean(o.initial),
      derived: o.derived || [],
      owns: o.owns || [],
    };
  }

  function transition(from, action, to, opts) {
    const o = opts || {};
    return {
      kind: 'transition',
      from,
      action,
      to,
      can: o.can || 'всегда',
      effect: o.effect || '',
      refuse: o.refuse || '',
      isEsc: Boolean(o.isEsc),
    };
  }

  function project(meta, spec) {
    return {
      kind: 'project',
      id: meta.id || 'project',
      title: meta.title || meta.id || 'Проект',
      summary: meta.summary || '',
      repo: spec.repo || null,
      terms: spec.terms || [],
      decisions: spec.decisions || [],
      invariants: spec.invariants || [],
      modules: spec.modules || [],
      sockets: spec.sockets || [],
      states: spec.states || [],
      transitions: spec.transitions || [],
      protocols: spec.protocols || [],
      algorithms: spec.algorithms || [],
    };
  }

  /* ── Обход икон ДРАКОНа (для проверки ссылок ins) ─────────────────────────── */

  function collectDrakonLinks(scheme) {
    const links = [];
    function walkItems(items) {
      if (!Array.isArray(items)) return;
      for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        if ((it.t === 'ins' || it.type === 'ins') && it.link) links.push(it.link);
        if (it.yes) walkItems(it.yes);
        if (it.no) walkItems(it.no);
        if (it.body) walkItems(it.body);
        if (Array.isArray(it.cases)) {
          for (const c of it.cases) walkItems(c.items || c.body);
        }
      }
    }
    const k = scheme && (scheme.kind || scheme.type);
    if (k === 'primitive') walkItems(scheme.items);
    if (k === 'silhouette' && Array.isArray(scheme.branches)) {
      for (const b of scheme.branches) walkItems(b.items);
    }
    return links;
  }

  /* ── 1. Проверка внутренней целостности самой модели Logos.lint(project) ───── */

  function lint(proj) {
    const issues = [];
    const push = (level, where, message) => issues.push({ level, where, message });

    if (!proj || proj.kind !== 'project') {
      push('error', 'project', 'Модель должна создаваться через Logos.project(meta, spec).');
      return issues;
    }

    const decisionIds = new Set();
    for (const d of proj.decisions) {
      if (decisionIds.has(d.id)) push('error', `decision:${d.id}`, `Повторяющийся id решения «${d.id}».`);
      decisionIds.add(d.id);
      if (!d.rule || !d.rule.trim()) push('error', `decision:${d.id}`, 'У решения не сформулировано правило (rule).');
    }

    const moduleMap = new Map();
    for (const m of proj.modules) {
      if (moduleMap.has(m.id)) push('error', `module:${m.id}`, `Повторяющийся id модуля «${m.id}».`);
      moduleMap.set(m.id, m);
    }

    const invariantIds = new Set();
    for (const inv of proj.invariants) {
      if (invariantIds.has(inv.id)) push('error', `invariant:${inv.id}`, `Повторяющийся id инварианта «${inv.id}».`);
      invariantIds.add(inv.id);
      if (!inv.decision || !decisionIds.has(inv.decision)) {
        push('error', `invariant:${inv.id}`, `Инвариант ссылается на неизвестное решение «${inv.decision}».`);
      }
      if ((!inv.guard || !String(inv.guard).trim()) && (!inv.rules || inv.rules.length === 0)) {
        push(
          'warn',
          `invariant:${inv.id}`,
          `Инвариант «${inv.title}» не прикрыт ни стражем (guard), ни правилом кода (rules). Нейросеть может нарушить его безнаказанно.`
        );
      }
      for (const modId of inv.scope || []) {
        if (!moduleMap.has(modId)) {
          push('error', `invariant:${inv.id}`, `В области действия указан неизвестный модуль «${modId}».`);
        }
      }
    }

    for (const m of proj.modules) {
      for (const depId of m.deps) {
        const target = moduleMap.get(depId);
        if (!target) {
          push('error', `module:${m.id}`, `Зависимость от неизвестного модуля «${depId}».`);
          continue;
        }
        if (depId === m.id) {
          push('error', `module:${m.id}`, 'Модуль зависит сам от себя.');
        } else if (target.layer > m.layer) {
          push(
            'error',
            `module:${m.id} → ${depId}`,
            `Пробой архитектуры слоёв: модуль нижнего слоя «${m.id}» (слой ${m.layer}) зависит от верхнего «${depId}» (слой ${target.layer}).`
          );
        }
      }
    }

    const socketIds = new Set();
    for (const s of proj.sockets) {
      if (socketIds.has(s.id)) push('error', `socket:${s.id}`, `Повторяющийся id разъёма «${s.id}».`);
      socketIds.add(s.id);
      if (!moduleMap.has(s.host)) {
        push('error', `socket:${s.id}`, `Разъём плагина привязан к неизвестному модулю «${s.host}».`);
      }
      if (!s.contract || !s.contract.trim()) {
        push('error', `socket:${s.id}`, 'У разъёма плагина не задан входной контракт (contract).');
      }
      if (!s.invariants || s.invariants.length === 0) {
        push('warn', `socket:${s.id}`, 'У разъёма плагина не указаны защищаемые инварианты ядра.');
      } else {
        for (const invId of s.invariants) {
          if (!invariantIds.has(invId)) {
            push('error', `socket:${s.id}`, `Разъём ссылается на неизвестный инвариант «${invId}».`);
          }
        }
      }
    }

    if (proj.states.length > 0) {
      const stateMap = new Map();
      let initials = 0;
      for (const st of proj.states) {
        if (stateMap.has(st.id)) push('error', `state:${st.id}`, `Повторяющееся состояние «${st.id}».`);
        stateMap.set(st.id, st);
        if (st.initial) initials++;
      }
      if (initials === 0) push('error', 'states', 'Не отмечено начальное состояние (initial: true).');
      if (initials > 1) push('error', 'states', `Начальных состояний больше одного (${initials}).`);

      const outgoing = new Map();
      const escOut = new Map();
      const pairSeen = new Set();
      for (const tr of proj.transitions) {
        if (!stateMap.has(tr.from)) push('error', `transition:${tr.from}→${tr.to}`, `Неизвестное исходное состояние «${tr.from}».`);
        if (!stateMap.has(tr.to)) push('error', `transition:${tr.from}→${tr.to}`, `Неизвестное целевое состояние «${tr.to}».`);
        const key = `${tr.from}::${tr.action}`;
        if (pairSeen.has(key)) {
          push('error', `transition:${tr.from}`, `Неоднозначный переход: действие «${tr.action}» из «${tr.from}» объявлено дважды.`);
        }
        pairSeen.add(key);
        if (!outgoing.has(tr.from)) outgoing.set(tr.from, []);
        outgoing.get(tr.from).push(tr);
        if (tr.isEsc) escOut.set(tr.from, tr.to);
      }

      const initState = proj.states.find((s) => s.initial);
      if (initState) {
        const visited = new Set([initState.id]);
        const queue = [initState.id];
        while (queue.length > 0) {
          const cur = queue.shift();
          for (const tr of outgoing.get(cur) || []) {
            if (stateMap.has(tr.to) && !visited.has(tr.to)) {
              visited.add(tr.to);
              queue.push(tr.to);
            }
          }
        }
        for (const st of proj.states) {
          if (!visited.has(st.id)) {
            push('error', `state:${st.id}`, `Состояние «${st.title}» (${st.id}) недостижимо из начального.`);
          }
          if (!outgoing.has(st.id) || outgoing.get(st.id).length === 0) {
            push('error', `state:${st.id}`, `Тупиковое состояние «${st.title}»: нет ни одного исходящего перехода.`);
          }
          if (!st.initial && !escOut.has(st.id)) {
            push('warn', `state:${st.id}`, `У неначального состояния «${st.title}» не задан возврат по Esc (isEsc: true).`);
          }
        }
      }
    }

    const algoIds = new Set(proj.algorithms.map((a) => a.id));
    for (const alg of proj.algorithms) {
      if (alg.module && !moduleMap.has(alg.module)) {
        push('error', `drakon:${alg.id}`, `Схема привязана к неизвестному модулю «${alg.module}».`);
      }
      if (alg.invariant && !invariantIds.has(alg.invariant)) {
        push('error', `drakon:${alg.id}`, `Схема ссылается на неизвестный инвариант «${alg.invariant}».`);
      }
      if (Drakon && typeof Drakon.lint === 'function') {
        const dIssues = Drakon.lint(alg.scheme);
        for (const di of dIssues) {
          push(di.level, `drakon:${alg.id} › ${di.where}`, di.message);
        }
      }
      for (const link of collectDrakonLinks(alg.scheme)) {
        if (!algoIds.has(link)) {
          push('error', `drakon:${alg.id}`, `Вставка ins ссылается на несуществующую схему «${link}».`);
        }
      }
    }

    for (const prot of proj.protocols) {
      if (Lanes && typeof Lanes.lint === 'function') {
        const lIssues = Lanes.lint(prot.scheme);
        for (const li of lIssues) {
          push(li.level, `lanes:${prot.id} › ${li.where}`, li.message);
        }
      }
    }

    return issues;
  }

  /* ── 2. Автоматическая сверка модели с живым репозиторием на диске (любой язык) ── */

  const IGNORE_DIRS = new Set(['node_modules', 'dist', 'out', 'build', 'target', 'bin', 'obj', '__pycache__', '.gradle', '.git']);
  const CODE_EXT_RE = /\.(ts|tsx|js|cjs|mjs|py|go|kt|kts|java|fs|cs|rs|c|cpp|cc|h|hpp)$/;

  function walkCodeFiles(dir, out) {
    out = out || [];
    if (!fs.existsSync(dir)) return out;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (IGNORE_DIRS.has(ent.name) || ent.name.startsWith('.')) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walkCodeFiles(full, out);
      } else if (CODE_EXT_RE.test(ent.name) && !ent.name.endsWith('.d.ts')) {
        out.push(full);
      }
    }
    return out;
  }

  // Извлечение импортов из строки исходника для JS/TS, Python, Go, Kotlin/Java, F#/C#, Rust, C/C++
  function extractImportsFromLine(line, ext) {
    const found = [];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#!') || (trimmed.startsWith('#') && !trimmed.startsWith('#include'))) {
      return found;
    }
    if (/\.(ts|tsx|js|cjs|mjs)$/.test(ext)) {
      const re = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)/g;
      let m;
      while ((m = re.exec(line)) !== null) found.push(m[1] || m[2]);
    } else if (ext === '.py') {
      const m1 = /^(?:from|import)\s+([a-zA-Z0-9_.]+)/.exec(trimmed);
      if (m1) found.push(m1[1]);
    } else if (ext === '.go') {
      const m1 = /"([^"]+)"/.exec(trimmed);
      if (m1 && (trimmed.startsWith('import ') || /^[a-z0-9_.]*\s*"[^"]+"$/.test(trimmed))) found.push(m1[1]);
    } else if (/\.(kt|kts|java)$/.test(ext)) {
      const m1 = /^import\s+([a-zA-Z0-9_.]+)/.exec(trimmed);
      if (m1) found.push(m1[1]);
    } else if (/\.(fs|cs)$/.test(ext)) {
      const m1 = /^(?:open|using)\s+([a-zA-Z0-9_.]+)/.exec(trimmed);
      if (m1) found.push(m1[1]);
    } else if (ext === '.rs') {
      const m1 = /^use\s+([a-zA-Z0-9_:]+)/.exec(trimmed);
      if (m1) found.push(m1[1]);
    } else if (/\.(c|cpp|cc|h|hpp)$/.test(ext)) {
      const m1 = /^#include\s+[<"]([^>"]+)[>"]/.exec(trimmed);
      if (m1) found.push(m1[1]);
    }
    return found;
  }

  function verifyRepo(proj, repoRoot) {
    if (!fs || !path) {
      throw new Error('Logos.verifyRepo доступна только в среде Node.js (требуется доступ к файловой системе).');
    }
    const rootDir = repoRoot || (proj.repo && proj.repo.root);
    const findings = [];
    const checks = [];
    const moduleStats = {};
    const invariantStatus = {};
    const stats = {
      rootDir,
      timestamp: new Date().toISOString(),
      filesScanned: 0,
      linesScanned: 0,
      importsChecked: 0,
      packagesVerified: 0,
      decisionsOnDisk: 0,
      ruleChecksRun: 0,
    };

    const addFinding = (level, category, where, message, moduleId, invariantId) => {
      const item = { level, category, where, message };
      if (moduleId) item.moduleId = moduleId;
      if (invariantId) item.invariantId = invariantId;
      findings.push(item);
      if (moduleId && moduleStats[moduleId]) {
        if (level === 'error') moduleStats[moduleId].errors++;
        else moduleStats[moduleId].warns++;
        moduleStats[moduleId].findings.push(item);
      }
      if (invariantId && invariantStatus[invariantId]) {
        if (level === 'error') invariantStatus[invariantId].errors++;
        else invariantStatus[invariantId].warns++;
        invariantStatus[invariantId].findings.push(item);
      }
    };
    const addPass = (category, where, detail, moduleId, invariantId) => {
      const item = { ok: true, category, where, detail };
      if (moduleId) item.moduleId = moduleId;
      if (invariantId) item.invariantId = invariantId;
      checks.push(item);
      if (invariantId && invariantStatus[invariantId]) {
        invariantStatus[invariantId].passed++;
        invariantStatus[invariantId].checks.push(item);
      }
    };

    for (const m of proj.modules) {
      moduleStats[m.id] = {
        id: m.id,
        files: 0,
        lines: 0,
        prodImports: [],
        testImports: [],
        errors: 0,
        warns: 0,
        findings: [],
      };
    }
    for (const inv of proj.invariants) {
      invariantStatus[inv.id] = {
        id: inv.id,
        passed: 0,
        errors: 0,
        warns: 0,
        checks: [],
        findings: [],
      };
    }

    if (!rootDir || !fs.existsSync(rootDir)) {
      addFinding('error', 'repo', String(rootDir), 'Корневой каталог репозитория не найден.');
      return { stats, findings, checks, moduleStats, invariantStatus };
    }

    if (proj.repo) {
      const rootPkgPath = path.join(rootDir, 'package.json');
      const expectsPkgJson =
        (proj.repo.requiredFiles && proj.repo.requiredFiles.includes('package.json')) ||
        (proj.repo.requiredScripts && proj.repo.requiredScripts.length > 0) ||
        (proj.repo.requiredTools && proj.repo.requiredTools.length > 0);
      if (expectsPkgJson && !fs.existsSync(rootPkgPath)) {
        addFinding('error', 'stack', 'package.json', 'Отсутствует корневой package.json.');
      } else if (fs.existsSync(rootPkgPath)) {
        const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
        for (const scr of proj.repo.requiredScripts || []) {
          if (!rootPkg.scripts || !rootPkg.scripts[scr]) {
            addFinding('error', 'stack', `package.json › scripts.${scr}`, `Обязательный скрипт «${scr}» отсутствует.`);
          }
        }
        const allRootDeps = Object.assign({}, rootPkg.dependencies, rootPkg.devDependencies);
        for (const tool of proj.repo.requiredTools || []) {
          if (!allRootDeps[tool]) {
            addFinding('error', 'stack', `package.json › ${tool}`, `Инструмент стека «${tool}» не найден в зависимостях корня.`);
          }
        }
        addPass('stack', 'package.json', `Скрипты (${(proj.repo.requiredScripts || []).join(', ')}) и стек проверены`);
      }

      for (const reqFile of proj.repo.requiredFiles || []) {
        const p = path.join(rootDir, reqFile);
        if (!fs.existsSync(p)) {
          addFinding('error', 'layout', reqFile, 'Обязательный файл/каталог структуры проекта не найден.');
        } else {
          addPass('layout', reqFile, 'На месте');
        }
      }

      if (proj.repo.decisionsDir) {
        const decDir = path.join(rootDir, proj.repo.decisionsDir);
        if (fs.existsSync(decDir)) {
          const diskFiles = fs.readdirSync(decDir).filter((f) => /^\d{4}-.*\.md$/.test(f)).sort();
          stats.decisionsOnDisk = diskFiles.length;
          const diskByNum = new Map();
          for (const f of diskFiles) diskByNum.set(f.slice(0, 4), f);
          for (const d of proj.decisions) {
            if (!diskByNum.has(d.id)) {
              addFinding(
                'error',
                'decisions',
                `decision:${d.id}`,
                `Решение «${d.id}» есть в базе Logos, но файл ${d.id}-*.md отсутствует в ${proj.repo.decisionsDir}.`
              );
            }
          }
          addPass(
            'decisions',
            proj.repo.decisionsDir,
            `На диске ${diskFiles.length} решений, в базе Logos связаны ${proj.decisions.length} ключевых`
          );
        }
      }
    }

    const pkgByName = new Map();
    for (const m of proj.modules) pkgByName.set(m.pkg, m);

    const packagesDir = path.join(rootDir, 'packages');
    if (fs.existsSync(packagesDir)) {
      const diskDirs = fs
        .readdirSync(packagesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => `packages/${d.name}`);
      const modelPaths = new Set(proj.modules.map((m) => m.path));
      for (const dp of diskDirs) {
        if (!modelPaths.has(dp)) {
          addFinding('error', 'modules', dp, `В репозитории обнаружен пакет «${dp}», не зарегистрированный в модели Logos.`);
        }
      }
    }

    // Сопоставление импортируемой строки с модулем проекта (для JS/TS @scope/pkg, Python pkg.sub, Go module/pkg, F#/C#/Kotlin namespace)
    function resolveTargetModule(rawSpec) {
      for (const m of proj.modules) {
        if (
          rawSpec === m.pkg ||
          rawSpec.startsWith(m.pkg + '/') ||
          rawSpec.startsWith(m.pkg + '.') ||
          rawSpec.startsWith(m.pkg + '::')
        ) {
          return m;
        }
      }
      return null;
    }

    for (const m of proj.modules) {
      const modDir = path.join(rootDir, m.path);
      if (!fs.existsSync(modDir)) {
        addFinding('error', 'modules', m.path, `Каталог модуля «${m.id}» не существует на диске.`, m.id);
        continue;
      }
      stats.packagesVerified++;

      const modPkgPath = path.join(modDir, 'package.json');
      let pkgJson = null;
      if (fs.existsSync(modPkgPath)) {
        pkgJson = JSON.parse(fs.readFileSync(modPkgPath, 'utf8'));
        if (pkgJson.name && m.pkg && pkgJson.name !== m.pkg) {
          addFinding('error', 'modules', `${m.path}/package.json`, `Имя пакета «${pkgJson.name}» не совпадает с моделью «${m.pkg}».`, m.id);
        }
      }

      for (const relF of m.files || []) {
        if (!fs.existsSync(path.join(modDir, relF))) {
          addFinding('error', 'layout', `${m.path}/${relF}`, `Обязательный узел структуры модуля «${m.id}» отсутствует на диске.`, m.id);
        }
      }

      const files = walkCodeFiles(modDir);
      const prodAllowed = new Set(m.deps);
      const testAllowed = new Set([...m.deps, ...(m.testDeps || [])]);
      const actualProdImported = new Set();
      const actualTestImported = new Set();
      let modLines = 0;

      for (const file of files) {
        const relFile = path.relative(rootDir, file);
        const ext = path.extname(file);
        const isTestOrBench =
          /(\.test|_test|Test)\.(ts|js|py|go|kt|fs|cs|rs)$/.test(file) ||
          relFile.includes('/test/') ||
          relFile.includes('/tests/') ||
          relFile.includes('/bench/') ||
          relFile.includes('/smoke/');
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        stats.filesScanned++;
        stats.linesScanned += lines.length;
        modLines += lines.length;

        for (let i = 0; i < lines.length; i++) {
          const specs = extractImportsFromLine(lines[i], ext);
          for (const rawSpec of specs) {
            const targetMod = resolveTargetModule(rawSpec);
            if (!targetMod || targetMod.id === m.id) continue;
            stats.importsChecked++;

            if (isTestOrBench) {
              actualTestImported.add(targetMod.id);
              if (!testAllowed.has(targetMod.id)) {
                addFinding(
                  'error',
                  'imports',
                  `${relFile}:${i + 1}`,
                  `Тест в «${m.id}» импортирует «${targetMod.pkg}», который не разрешён ни в deps, ни в testDeps.`,
                  m.id
                );
              }
            } else {
              actualProdImported.add(targetMod.id);
              if (!prodAllowed.has(targetMod.id)) {
                addFinding(
                  'error',
                  'imports',
                  `${relFile}:${i + 1}`,
                  `Нарушение границы модуля: боевой код «${m.id}» (слой ${m.layer}) импортирует «${targetMod.pkg}» (разрешены только: ${m.deps.join(', ') || 'нет'}).`,
                  m.id
                );
              }
            }
          }
        }
      }

      moduleStats[m.id].files = files.length;
      moduleStats[m.id].lines = modLines;
      moduleStats[m.id].prodImports = Array.from(actualProdImported);
      moduleStats[m.id].testImports = Array.from(actualTestImported);

      if (pkgJson) {
        const declaredKeelDeps = Object.keys(pkgJson.dependencies || {})
          .filter((k) => k.startsWith('@keel/'))
          .map((k) => (pkgByName.get(k) ? pkgByName.get(k).id : k));

        for (const depId of declaredKeelDeps) {
          if (!prodAllowed.has(depId)) {
            const onlyInTests = actualTestImported.has(depId);
            addFinding(
              'warn',
              'package.json',
              `${m.path}/package.json`,
              onlyInTests
                ? `Пакет «@keel/${depId}» записан в боевые dependencies «${m.id}», хотя в боевом коде не используется (только в тестах — должен быть в devDependencies).`
                : `Пакет «@keel/${depId}» записан в dependencies «${m.id}», но отсутствует в модели Logos (${m.id}.deps) и ни разу не импортируется в коде.`,
              m.id
            );
          }
        }
      }

      addPass(
        'modules',
        `${m.id} (${m.path})`,
        `Файлов: ${files.length} (${modLines} стр.), боевые импорты: [${Array.from(actualProdImported).join(', ') || '—'}] ⊆ [${m.deps.join(', ') || '—'}]`,
        m.id
      );
    }

    for (const inv of proj.invariants) {
      for (const rule of inv.rules || []) {
        stats.ruleChecksRun++;
        if (rule.kind === 'file-exists') {
          for (const relP of rule.paths || []) {
            if (!fs.existsSync(path.join(rootDir, relP))) {
              addFinding(
                'error',
                `guard:${inv.id}`,
                relP,
                `Отсутствует файл стража/схемы для инварианта ${inv.id}: ${rule.message || relP}`,
                inv.scope[0],
                inv.id
              );
            } else {
              addPass(`guard:${inv.id}`, relP, rule.message || 'Файл стража на месте', inv.scope[0], inv.id);
            }
          }
        } else if (rule.kind === 'forbid-regex') {
          const targetDir = path.join(rootDir, rule.dir);
          const files = walkCodeFiles(targetDir);
          const re = new RegExp(rule.pattern, rule.flags || '');
          const ignoreList = rule.ignore || [];
          let hits = 0;

          for (const file of files) {
            const relFile = path.relative(rootDir, file);
            if (ignoreList.some((ig) => relFile.includes(ig))) continue;
            const lines = fs.readFileSync(file, 'utf8').split('\n');
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (rule.skipComments && (line.trim().startsWith('//') || line.trim().startsWith('*'))) continue;
              if (re.test(line)) {
                hits++;
                addFinding(
                  rule.level || 'error',
                  `guard:${inv.id}`,
                  `${relFile}:${i + 1}`,
                  `${rule.message} (найдено: ${line.trim().slice(0, 70)})`,
                  inv.scope[0],
                  inv.id
                );
              }
            }
          }
          if (hits === 0) {
            addPass(`guard:${inv.id}`, rule.dir, `${rule.message} — 0 нарушений (${files.length} файлов)`, inv.scope[0], inv.id);
          }
        } else if (rule.kind === 'require-regex') {
          const targetFile = path.join(rootDir, rule.file);
          if (!fs.existsSync(targetFile)) {
            addFinding('error', `guard:${inv.id}`, rule.file, `Файл не найден для проверки: ${rule.message}`, inv.scope[0], inv.id);
          } else {
            const content = fs.readFileSync(targetFile, 'utf8');
            const re = new RegExp(rule.pattern, rule.flags || '');
            if (!re.test(content)) {
              addFinding(
                rule.level || 'error',
                `guard:${inv.id}`,
                rule.file,
                `Не найдена обязательная конструкция: ${rule.message}`,
                inv.scope[0],
                inv.id
              );
            } else {
              addPass(`guard:${inv.id}`, rule.file, rule.message, inv.scope[0], inv.id);
            }
          }
        }
      }
    }

    return { stats, findings, checks, moduleStats, invariantStatus };
  }

  /* ── SVG-представление 1: Интерактивная карта слоёв, модулей и сокетов ─────── */

  function layersSvg(proj, issues, verifySnapshot) {
    const layersMap = new Map();
    for (const m of proj.modules) {
      if (!layersMap.has(m.layer)) {
        layersMap.set(m.layer, { layer: m.layer, name: m.layerName, modules: [] });
      }
      layersMap.get(m.layer).modules.push(m);
    }
    const layers = Array.from(layersMap.values()).sort((a, b) => b.layer - a.layer);

    const socketsByHost = new Map();
    for (const s of proj.sockets) {
      if (!socketsByHost.has(s.host)) socketsByHost.set(s.host, []);
      socketsByHost.get(s.host).push(s);
    }

    const padX = 18;
    const padY = 18;
    const labelW = 195;
    const cardW = 248;
    const cardH = 74;
    const gapX = 20;
    const layerGapY = 26;

    const maxCols = Math.max(1, ...layers.map((l) => l.modules.length));
    const contentW = maxCols * cardW + (maxCols - 1) * gapX + 32;
    const totalW = padX * 2 + labelW + contentW;

    const layerBoxes = [];
    const modCoords = new Map();
    let curY = padY;

    for (const l of layers) {
      const maxSocks = Math.max(0, ...l.modules.map((m) => (socketsByHost.get(m.id) || []).length));
      const rowH = cardH + 24 + maxSocks * 28;
      layerBoxes.push({ layer: l, y: curY, h: rowH });

      l.modules.forEach((m, idx) => {
        const mx = padX + labelW + 16 + idx * (cardW + gapX);
        const my = curY + 12;
        const socksCount = (socketsByHost.get(m.id) || []).length;
        modCoords.set(m.id, { x: mx, y: my, w: cardW, h: cardH, bottomY: my + cardH + socksCount * 28, mod: m });
      });

      curY += rowH + layerGapY;
    }

    const totalH = curY - layerGapY + padY;
    const out = [];
    out.push(
      `<svg class="lg lg-layers-svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">`
    );
    out.push(
      `<defs>` +
        `<marker id="lg-dep-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,1 L7,4 L0,7 z" class="lg-arrow"/></marker>` +
      `</defs>`
    );

    for (const lb of layerBoxes) {
      out.push(
        `<rect x="${padX}" y="${lb.y}" width="${totalW - padX * 2}" height="${lb.h}" rx="8" class="lg-layer"/>`
      );
      out.push(
        `<text x="${padX + 14}" y="${lb.y + 26}" class="lg-layer-t">Слой ${lb.layer.layer}</text>`
      );
      out.push(
        `<text x="${padX + 14}" y="${lb.y + 44}" class="lg-sub">${esc(lb.layer.name)}</text>`
      );
    }

    for (const m of proj.modules) {
      const from = modCoords.get(m.id);
      if (!from) continue;
      for (const depId of m.deps) {
        const to = modCoords.get(depId);
        if (!to) continue;
        const x1 = from.x + from.w / 2;
        const y1 = from.bottomY;
        const x2 = to.x + to.w / 2;
        const y2 = to.y;
        const dataAttrs = `data-dep-from="${esc(m.id)}" data-dep-to="${esc(depId)}"`;
        if (Math.abs(x1 - x2) < 4) {
          out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="lg-edge-dep" ${dataAttrs} marker-end="url(#lg-dep-arr)"/>`);
        } else {
          const midY = Math.round((y1 + y2) / 2);
          out.push(
            `<path d="M${x1},${y1} L${x1},${midY} L${x2},${midY} L${x2},${y2}" class="lg-edge-dep" ${dataAttrs} marker-end="url(#lg-dep-arr)"/>`
          );
        }
      }
    }

    const mStatsMap = (verifySnapshot && verifySnapshot.moduleStats) || {};

    for (const [id, box] of modCoords.entries()) {
      const m = box.mod;
      const ms = mStatsMap[id];
      const nodeIssues = getIssuesFor(issues, `module:${id}`);
      const hasErr = nodeIssues.some(i => i.level === 'error');
      
      let statusCls = '';
      let badgeText = m.id;
      if (hasErr || (ms && ms.errors > 0)) {
        statusCls = ' lg-mod-err';
        badgeText = `✗ ${hasErr ? nodeIssues.length : ms.errors} ош.`;
      } else if (ms && ms.warns > 0) {
        statusCls = ' lg-mod-warn';
        badgeText = `⚠ ${ms.warns} пред.`;
      } else {
        statusCls = ' lg-mod-ok';
        badgeText = `✓ ${ms ? ms.files : ''} ф.`;
      }
      
      const cls = (m.layer <= 1 ? 'lg-mod lg-mod-core' : 'lg-mod') + statusCls;

      out.push(`<g class="lg-node-group" data-module="${esc(id)}" data-issues="${esc(JSON.stringify(nodeIssues))}" tabindex="0" role="button">`);
      out.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="7" class="${cls}"/>`);
      const titleShort = m.title.length > 22 ? m.title.slice(0, 21) + '…' : m.title;
      out.push(`<text x="${box.x + 12}" y="${box.y + 20}" class="lg-t lg-b">${esc(titleShort)}</text>`);
      out.push(`<text x="${box.x + box.w - 10}" y="${box.y + 20}" text-anchor="end" class="lg-code">${esc(badgeText)}</text>`);
      const roleShort = m.role.length > 35 ? m.role.slice(0, 34) + '…' : m.role;
      out.push(`<text x="${box.x + 12}" y="${box.y + 39}" class="lg-sub">${esc(roleShort)}</text>`);
      const depsText = m.deps.length ? `${m.path} → ${m.deps.join(', ')}` : `${m.path} (фундамент)`;
      out.push(`<text x="${box.x + 12}" y="${box.y + 58}" class="lg-code">${esc(depsText)}</text>`);
      out.push(`</g>`);

      const socks = socketsByHost.get(id) || [];
      socks.forEach((s, sIdx) => {
        const sy = box.y + box.h + 6 + sIdx * 26;
        const sockTitle = s.title.length > 29 ? s.title.slice(0, 28) + '…' : s.title;
        out.push(`<g class="lg-socket-group" data-socket="${esc(s.id)}" data-host="${esc(id)}" tabindex="0" role="button">`);
        out.push(`<rect x="${box.x + 6}" y="${sy}" width="${box.w - 12}" height="22" rx="5" class="lg-socket"/>`);
        out.push(`<text x="${box.x + 12}" y="${sy + 15}" class="lg-socket-t">🔌 ${esc(sockTitle)}</text>`);
        out.push(`</g>`);
      });
    }

    out.push('</svg>');
    return out.join('\n');
  }

  /* ── SVG-представление 2: Интерактивный автомат состояний (с диагностикой) ─ */

  function statesSvg(proj, issues) {
    const states = proj.states;
    const transitions = proj.transitions;
    if (!states.length) return '<svg class="lg" width="200" height="40"></svg>';

    const forwardEdges = transitions.filter((t) => !t.isEsc);
    const escEdges = transitions.filter((t) => t.isEsc);

    const padX = 20;
    const colW = 180;
    const gapX = 22;
    const boxH = 74;
    const escRailStep = 19;
    const topY = 24 + escEdges.length * escRailStep + 12;

    const coords = new Map();
    states.forEach((st, idx) => {
      const x = padX + idx * (colW + gapX);
      coords.set(st.id, { x, y: topY, w: colW, h: boxH, index: idx, state: st });
    });

    const laneStart = topY + boxH + 26;
    const laneStep = 28;
    const totalW = padX * 2 + states.length * colW + (states.length - 1) * gapX;
    const totalH = laneStart + forwardEdges.length * laneStep + 26;

    const out = [];
    out.push(
      `<svg class="lg lg-states-svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}" xmlns="http://www.w3.org/2000/svg">`
    );
    out.push(
      `<defs>` +
        `<marker id="lg-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L7,4 L0,7 z" class="lg-arrow"/></marker>` +
        `<marker id="lg-arr-esc" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L7,4 L0,7 z" class="lg-arrow-esc"/></marker>` +
      `</defs>`
    );

    escEdges.forEach((tr, idx) => {
      const a = coords.get(tr.from);
      const b = coords.get(tr.to);
      if (!a || !b) return;
      const x1 = a.x + a.w / 2 - 8;
      const y1 = a.y;
      const x2 = b.x + b.w / 2 + 8 + idx * 4;
      const y2 = b.y;
      const railY = 20 + idx * escRailStep;
      out.push(`<g class="lg-trans-esc" data-from="${esc(tr.from)}" data-to="${esc(tr.to)}">`);
      out.push(
        `<path d="M${x1},${y1} L${x1},${railY} L${x2},${railY} L${x2},${y2}" class="lg-edge-esc" marker-end="url(#lg-arr-esc)"/>`
      );
      const midX = Math.round((x1 + x2) / 2);
      out.push(`<text x="${midX}" y="${railY - 4}" text-anchor="middle" class="lg-sub">Esc: ${esc(tr.action)}</text>`);
      out.push(`</g>`);
    });

    for (const [, box] of coords.entries()) {
      const st = box.state;
      const nodeIssues = getIssuesFor(issues, `state:${st.id}`);
      const hasErr = nodeIssues.some(i => i.level === 'error');
      
      const cls = (st.initial ? 'lg-state lg-state-init' : 'lg-state') + (hasErr ? ' lg-state-err' : '');
      out.push(`<g class="lg-state-group" data-state="${esc(st.id)}" data-issues="${esc(JSON.stringify(nodeIssues))}" tabindex="0" role="button">`);
      out.push(`<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="7" class="${cls}"/>`);
      const badge = st.initial ? '● ' : '';
      const stTitle = (badge + st.title).length > 18 ? (badge + st.title).slice(0, 17) + '…' : badge + st.title;
      out.push(`<text x="${box.x + 10}" y="${box.y + 21}" class="lg-t lg-b">${esc(stTitle)}</text>`);
      out.push(`<text x="${box.x + box.w - 8}" y="${box.y + 21}" text-anchor="end" class="lg-code">${esc(st.id)}</text>`);

      const ownsTxt = st.owns.length ? `хранит: ${st.owns.join(', ')}` : 'хранит: —';
      const derTxt = st.derived.length ? `вычисл.: ${st.derived.join(', ')}` : '';
      out.push(
        `<text x="${box.x + 10}" y="${box.y + 42}" class="lg-sub">${esc(ownsTxt.length > 25 ? ownsTxt.slice(0, 24) + '…' : ownsTxt)}</text>`
      );
      if (derTxt) {
        out.push(
          `<text x="${box.x + 10}" y="${box.y + 59}" class="lg-code">${esc(derTxt.length > 24 ? derTxt.slice(0, 23) + '…' : derTxt)}</text>`
        );
      }
      out.push(`</g>`);

      const cx = box.x + box.w / 2;
      out.push(
        `<line x1="${cx}" y1="${box.y + box.h}" x2="${cx}" y2="${totalH - 18}" stroke="var(--lg-hairline)" stroke-dasharray="3 3"/>`
      );
    }

    forwardEdges.forEach((tr, i) => {
      const a = coords.get(tr.from);
      const b = coords.get(tr.to);
      if (!a || !b) return;
      const y = laneStart + i * laneStep;
      const x1 = a.x + a.w / 2;
      const x2 = b.x + b.w / 2;
      out.push(`<g class="lg-trans-fwd" data-from="${esc(tr.from)}" data-to="${esc(tr.to)}" data-action="${esc(tr.action)}">`);
      out.push(`<circle cx="${x1}" cy="${y}" r="3.2" class="lg-arrow"/>`);
      out.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="lg-edge" marker-end="url(#lg-arr)"/>`);
      const midX = Math.round((x1 + x2) / 2);
      const label = tr.can && tr.can !== 'всегда' ? `${tr.action} [${tr.can}]` : tr.action;
      out.push(`<text x="${midX}" y="${y - 5}" text-anchor="middle" class="lg-t">${esc(label)}</text>`);
      out.push(`</g>`);
    });

    out.push('</svg>');
    return out.join('\n');
  }

  /* ── Выгрузка «прошивки» (ТЗ / Контракта) для ИИ-агента под конкретную область ─ */

  function brief(proj, moduleId) {
    const lines = [];
    lines.push(`# КОНТРАКТ LOGOS ДЛЯ ПРОЕКТА «${proj.title}»`);
    if (proj.repo) {
      lines.push(`Корень репозитория: \`${proj.repo.root}\``);
      if (proj.repo.stack) lines.push(`Стек: ${proj.repo.stack.join(' · ')}`);
    }
    if (moduleId) {
      const mod = proj.modules.find((m) => m.id === moduleId);
      if (!mod) return `Неизвестный модуль «${moduleId}».`;
      lines.push(`Целевой модуль: \`${mod.id}\` (\`${mod.pkg}\`, каталог \`${mod.path}\`, слой ${mod.layer} — ${mod.layerName})`);
      lines.push(`Роль: ${mod.role}`);
      lines.push(`Обязательные узлы каталога: ${(mod.files || []).map((f) => '`' + f + '`').join(', ') || '—'}`);
      lines.push(`Разрешённые боевые импорты: ${mod.deps.length ? mod.deps.map((d) => '`@keel/' + d + '`').join(', ') : 'НЕТ (фундамент, слой 0)'}`);
      const forbidden = proj.modules.filter((m) => m.id !== mod.id && !mod.deps.includes(m.id)).map((m) => `@keel/${m.id}`);
      lines.push(`Запрещённые боевые импорты: ${forbidden.map((d) => '`' + d + '`').join(', ')}`);
    } else {
      lines.push(`Полный срез системы (${proj.modules.length} модулей, ${proj.invariants.length} инвариантов, ${proj.sockets.length} разъёмов плагинов).`);
    }

    lines.push('\n## Обязательные инварианты (проверяются Logos.verifyRepo)');
    const relInvariants = moduleId
      ? proj.invariants.filter((inv) => !inv.scope || inv.scope.length === 0 || inv.scope.includes(moduleId))
      : proj.invariants;
    for (const inv of relInvariants) {
      lines.push(`- **[${inv.id}] ${inv.title}** (Решение ${inv.decision})`);
      if (inv.why) lines.push(`  Причина: ${inv.why}`);
      lines.push(`  Страж: \`${inv.guard || 'правила кода verifyRepo'}\` (авто-правил: ${(inv.rules || []).length})`);
    }

    const relSockets = moduleId ? proj.sockets.filter((s) => s.host === moduleId) : proj.sockets;
    if (relSockets.length > 0) {
      lines.push('\n## Официальные разъёмы под плагины (Sockets)');
      for (const s of relSockets) {
        lines.push(`- **🔌 ${s.id} (${s.title})** в модуле \`${s.host}\``);
        lines.push(`  Контракт: ${s.contract}`);
        lines.push(`  Охраняемые инварианты: ${s.invariants.join(', ')}`);
        if (s.examples.length) lines.push(`  Примеры плагинов: ${s.examples.join(', ')}`);
      }
    }

    if (!moduleId || moduleId === 'app' || moduleId === 'api') {
      lines.push('\n## Автомат состояний и допустимые переходы');
      for (const tr of proj.transitions) {
        const escTag = tr.isEsc ? ' [возврат Esc]' : '';
        lines.push(`- \`${tr.from}\` ──(${tr.action})──► \`${tr.to}\`${escTag} | условие: ${tr.can}${tr.refuse ? ' | отказ: «' + tr.refuse + '»' : ''}`);
      }
    }

    return lines.join('\n');
  }

  /* ── Безапелляционный вердикт по расхождениям для ИИ (Logos.judge) ─────────── */

  function judge(proj, verifySnapshot, moduleId) {
    const modelIssues = lint(proj);
    const repoFindings = (verifySnapshot && verifySnapshot.findings) || [];
    const filteredRepo = moduleId
      ? repoFindings.filter((f) => f.moduleId === moduleId || f.where.includes(`packages/${moduleId}`))
      : repoFindings;

    const lines = [];
    lines.push(`# ДИРЕКТИВА АРХИТЕКТУРНОГО КОНТРОЛЯ LOGOS (${proj.title})`);
    lines.push(`Это автоматический вердикт верификатора Logos. Обсуждение целесообразности правил не требуется — требуется устранить расхождения между кодом и формальной моделью.`);

    if (modelIssues.length === 0 && filteredRepo.length === 0) {
      lines.push('\n✓ Нарушений не обнаружено. Код и модель согласованы.');
      return lines.join('\n');
    }

    if (modelIssues.length > 0) {
      lines.push('\n## 1. Замечания по формальной модели (Logos.lint)');
      for (const i of modelIssues) {
        lines.push(`- [${i.level.toUpperCase()}] \`${i.where}\`: ${i.message}`);
      }
    }

    if (filteredRepo.length > 0) {
      lines.push(`\n## 2. Нарушения в коде репозитория (${filteredRepo.length})`);
      filteredRepo.forEach((f, idx) => {
        lines.push(`${idx + 1}. **[${f.level.toUpperCase()}] \`${f.where}\`** (${f.category})`);
        lines.push(`   Проблема: ${f.message}`);
      });
      lines.push('\n## Порядок исполнения:');
      lines.push('1. Для каждого пункта исправить импорт, package.json или добавить требуемый страж.');
      lines.push('2. Прогнать `node /mnt/Projects/research/Logos/cli.js check` и убедиться, что ошибок 0.');
    }

    return lines.join('\n');
  }

  /* ── Текстовый отчёт для CLI / консоли ────────────────────────────────────── */

  function report(proj, repoRoot) {
    const issues = lint(proj);
    const errs = issues.filter((i) => i.level === 'error');
    const warns = issues.filter((i) => i.level === 'warn');
    const lines = [];
    lines.push(`Logos: проверка модели «${proj.title}»`);
    lines.push(
      `  Решений: ${proj.decisions.length} · Инвариантов: ${proj.invariants.length} · Модулей: ${proj.modules.length} · Разъёмов плагинов: ${proj.sockets.length}`
    );
    lines.push(
      `  Состояний: ${proj.states.length} · Переходов: ${proj.transitions.length} · Протоколов (Lanes): ${proj.protocols.length} · Алгоритмов (ДРАКОН): ${proj.algorithms.length}`
    );
    lines.push(`  Модель lint(): ошибок — ${errs.length}, предупреждений — ${warns.length}`);
    for (const iss of issues) {
      const tag = iss.level === 'error' ? '✗ ERROR' : '⚠ WARN ';
      lines.push(`  ${tag} [${iss.where}] ${iss.message}`);
    }

    const targetRoot = repoRoot || (proj.repo && proj.repo.root);
    if (fs && targetRoot && fs.existsSync(targetRoot)) {
      const v = verifyRepo(proj, targetRoot);
      const vErrs = v.findings.filter((f) => f.level === 'error');
      const vWarns = v.findings.filter((f) => f.level === 'warn');
      lines.push('');
      lines.push(`Logos: сверка модели с живым репозиторием (${targetRoot})`);
      lines.push(
        `  Проверено пакетов: ${v.stats.packagesVerified} · Файлов кода: ${v.stats.filesScanned} (${v.stats.linesScanned} строк) · Межмодульных импортов: ${v.stats.importsChecked} · Правил стражей: ${v.stats.ruleChecksRun}`
      );
      lines.push(`  Сверка verifyRepo(): успешных проверок — ${v.checks.length}, ошибок — ${vErrs.length}, предупреждений — ${vWarns.length}`);
      for (const f of v.findings) {
        const tag = f.level === 'error' ? '✗ ERROR' : '⚠ WARN ';
        lines.push(`  ${tag} [${f.category} › ${f.where}] ${f.message}`);
      }
    }

    return lines.join('\n');
  }

  /* ── 3. Детерминированный реверс-инжиниринг репозитория в модель Logos ─────── */

  function discoverRepo(repoRoot) {
    if (!fs || !path) {
      throw new Error('Logos.discoverRepo доступна только в среде Node.js.');
    }
    const rootDir = path.resolve(repoRoot);
    if (!fs.existsSync(rootDir)) {
      throw new Error(`Каталог не найден: ${rootDir}`);
    }

    const repoId = path.basename(rootDir);
    let title = repoId;
    let summary = `Автоматически снятая архитектурная модель репозитория ${repoId}`;
    const stack = new Set();
    const requiredFiles = [];
    const requiredScripts = [];
    let decisionsDir = null;

    // 1. Определение стека и конфигурационных файлов
    const candidateConfigs = [
      'package.json',
      'tsconfig.json',
      'tsconfig.base.json',
      'biome.json',
      'vitest.config.ts',
      'go.mod',
      'settings.gradle.kts',
      'build.gradle.kts',
      'pyproject.toml',
      '.githooks/pre-commit',
    ];
    for (const cf of candidateConfigs) {
      if (fs.existsSync(path.join(rootDir, cf))) requiredFiles.push(cf);
    }

    const rootPkgPath = path.join(rootDir, 'package.json');
    if (fs.existsSync(rootPkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
      if (pkg.name) title = pkg.name;
      if (pkg.description) summary = pkg.description;
      const allDeps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
      if (allDeps.typescript) stack.add('TypeScript');
      if (allDeps.vitest) stack.add('Vitest');
      if (allDeps['@biomejs/biome']) stack.add('Biome');
      if (allDeps.electron) stack.add('Electron');
      if (pkg.scripts) {
        for (const s of ['check', 'test', 'typecheck', 'lint', 'build', 'smoke']) {
          if (pkg.scripts[s]) requiredScripts.push(s);
        }
      }
    }

    const readmePath = path.join(rootDir, 'README.md');
    if (fs.existsSync(readmePath)) {
      const rLines = fs.readFileSync(readmePath, 'utf8').split('\n');
      const h1 = rLines.find((l) => l.startsWith('# '));
      if (h1) title = h1.replace(/^#\s+/, '').trim();
      const para = rLines.find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('|') && !l.startsWith('`'));
      if (para) summary = para.trim().slice(0, 180);
    }

    // 2. Обнаружение модулей для разных экосистем (Node/TS packages/*, Gradle settings.gradle.kts, Go go.mod, Python)
    const rawModules = [];

    const pkgsDir = path.join(rootDir, 'packages');
    if (fs.existsSync(pkgsDir) && fs.statSync(pkgsDir).isDirectory()) {
      stack.add('Node.js Workspaces');
      const dirs = fs.readdirSync(pkgsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      for (const d of dirs) {
        const modRel = `packages/${d.name}`;
        const modAbs = path.join(rootDir, modRel);
        const pJsonPath = path.join(modAbs, 'package.json');
        let pkgName = `@${repoId}/${d.name}`;
        let role = `Пакет ${d.name}`;
        if (fs.existsSync(pJsonPath)) {
          const pj = JSON.parse(fs.readFileSync(pJsonPath, 'utf8'));
          if (pj.name) pkgName = pj.name;
          if (pj.description) role = pj.description;
        }
        const subFiles = [];
        const srcDir = path.join(modAbs, 'src');
        if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
          const subs = fs
            .readdirSync(srcDir, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => `src/${e.name}`);
          subFiles.push(...subs.slice(0, 4));
          if (subFiles.length === 0) subFiles.push('src');
        }
        rawModules.push({
          id: d.name,
          title: d.name,
          pkg: pkgName,
          path: modRel,
          role,
          files: subFiles,
        });
      }
    }

    const gradleSettingsPath = path.join(rootDir, 'settings.gradle.kts');
    if (rawModules.length === 0 && fs.existsSync(gradleSettingsPath)) {
      stack.add('Kotlin');
      stack.add('Gradle');
      const gText = fs.readFileSync(gradleSettingsPath, 'utf8');
      const incRe = /include\(\s*"([^"]+)"\s*\)/g;
      let m;
      const gradleMods = [];
      while ((m = incRe.exec(gText)) !== null) {
        gradleMods.push(m[1]);
      }
      for (const gm of gradleMods) {
        const cleanPath = gm.replace(/^:/, '').replace(/:/g, '/');
        const modAbs = path.join(rootDir, cleanPath);
        if (!fs.existsSync(modAbs)) continue;
        const id = gm.replace(/^:/, '').replace(/:/g, '-');
        const ktFiles = walkCodeFiles(modAbs).filter((f) => f.endsWith('.kt'));
        let pkgPrefix = id;
        if (ktFiles.length > 0) {
          const firstKt = fs.readFileSync(ktFiles[0], 'utf8');
          const pm = /^package\s+([a-zA-Z0-9_.]+)/m.exec(firstKt);
          if (pm) pkgPrefix = pm[1];
        }
        rawModules.push({
          id,
          title: gm,
          pkg: pkgPrefix,
          path: cleanPath,
          role: `Gradle-модуль ${gm} (${ktFiles.length} .kt файлов)`,
          files: ['build.gradle.kts'],
        });
      }
    }

    const goModPath = path.join(rootDir, 'go.mod');
    if (rawModules.length === 0 && fs.existsSync(goModPath)) {
      stack.add('Go');
      const goText = fs.readFileSync(goModPath, 'utf8');
      const mm = /^module\s+(\S+)/m.exec(goText);
      const goModuleName = mm ? mm[1] : repoId;
      for (const topFolder of ['cmd', 'internal', 'pkg']) {
        const absTop = path.join(rootDir, topFolder);
        if (!fs.existsSync(absTop) || !fs.statSync(absTop).isDirectory()) continue;
        const subs = fs.readdirSync(absTop, { withFileTypes: true }).filter((d) => d.isDirectory());
        for (const s of subs) {
          const rel = `${topFolder}/${s.name}`;
          rawModules.push({
            id: `${topFolder}-${s.name}`,
            title: `${topFolder}/${s.name}`,
            pkg: `${goModuleName}/${rel}`,
            path: rel,
            role: `Go-пакет ${rel}`,
            files: [],
          });
        }
      }
    }

    if (rawModules.length === 0) {
      const topDirs = fs
        .readdirSync(rootDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !IGNORE_DIRS.has(d.name) && !d.name.startsWith('.') && d.name !== 'docs' && d.name !== 'tests');
      for (const d of topDirs) {
        const codeFiles = walkCodeFiles(path.join(rootDir, d.name));
        if (codeFiles.length === 0) continue;
        if (codeFiles.some((f) => f.endsWith('.py'))) stack.add('Python');
        rawModules.push({
          id: d.name,
          title: d.name,
          pkg: d.name,
          path: d.name,
          role: `Модуль ${d.name} (${codeFiles.length} файлов)`,
          files: [],
        });
      }
    }

    // 3. Сканирование реальных импортов между обнаруженными модулями
    function resolveDiscoveredMod(rawSpec) {
      for (const m of rawModules) {
        if (
          rawSpec === m.pkg ||
          rawSpec.startsWith(m.pkg + '/') ||
          rawSpec.startsWith(m.pkg + '.') ||
          rawSpec.startsWith(m.pkg + '::')
        ) {
          return m;
        }
      }
      return null;
    }

    for (const m of rawModules) {
      const modAbs = path.join(rootDir, m.path);
      const files = walkCodeFiles(modAbs);
      const prodDeps = new Set();
      const testDeps = new Set();

      const gradleBuild = path.join(modAbs, 'build.gradle.kts');
      if (fs.existsSync(gradleBuild)) {
        const gbText = fs.readFileSync(gradleBuild, 'utf8');
        const pRe = /project\(\s*"([^"]+)"\s*\)/g;
        let pm;
        while ((pm = pRe.exec(gbText)) !== null) {
          const targetId = pm[1].replace(/^:/, '').replace(/:/g, '-');
          if (targetId !== m.id && rawModules.some((rm) => rm.id === targetId)) {
            prodDeps.add(targetId);
          }
        }
      }

      for (const file of files) {
        const relFile = path.relative(rootDir, file);
        const ext = path.extname(file);
        const isTest =
          /(\.test|_test|Test)\.(ts|js|py|go|kt|fs|cs|rs)$/.test(file) ||
          relFile.includes('/test/') ||
          relFile.includes('/tests/') ||
          relFile.includes('/bench/') ||
          relFile.includes('/smoke/');
        const lines = fs.readFileSync(file, 'utf8').split('\n');
        for (const line of lines) {
          const specs = extractImportsFromLine(line, ext);
          for (const sp of specs) {
            const target = resolveDiscoveredMod(sp);
            if (!target || target.id === m.id) continue;
            if (isTest) testDeps.add(target.id);
            else prodDeps.add(target.id);
          }
        }
      }

      m.deps = Array.from(prodDeps);
      m.testDeps = Array.from(testDeps).filter((d) => !prodDeps.has(d));
    }

    // 4. Топологическое вычисление слоёв
    const modById = new Map(rawModules.map((m) => [m.id, m]));
    const memoLayer = new Map();
    const visiting = new Set();
    function computeLayer(id) {
      if (memoLayer.has(id)) return memoLayer.get(id);
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const m = modById.get(id);
      let lvl = 0;
      if (m && m.deps.length > 0) {
        lvl = 1 + Math.max(...m.deps.map((depId) => computeLayer(depId)));
      }
      visiting.delete(id);
      memoLayer.set(id, lvl);
      return lvl;
    }
    for (const m of rawModules) {
      m.layer = computeLayer(m.id);
    }

    // 5. Автоматическое чтение решений из docs/decisions/*.md
    const decisions = [];
    const candidateDecDir = path.join(rootDir, 'docs', 'decisions');
    if (fs.existsSync(candidateDecDir) && fs.statSync(candidateDecDir).isDirectory()) {
      decisionsDir = 'docs/decisions';
      const decFiles = fs
        .readdirSync(candidateDecDir)
        .filter((f) => /^\d{4}-.*\.md$/.test(f))
        .sort();
      for (const f of decFiles) {
        const id = f.slice(0, 4);
        const text = fs.readFileSync(path.join(candidateDecDir, f), 'utf8');
        const lines = text.split('\n');
        const h1 = lines.find((l) => l.startsWith('# '));
        const decTitle = h1 ? h1.replace(/^#\s+/, '').replace(/^\d{4}\.\s*/, '').trim() : f;
        const bodyLine = lines.find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('|'));
        const rule = bodyLine ? bodyLine.trim().slice(0, 140) : decTitle;
        decisions.push(decision(id, decTitle, rule, { file: f }));
      }
    }
    if (decisions.length === 0) {
      decisions.push(decision('0001', 'Слоистая архитектура модулей', 'Зависимости направлены строго сверху вниз по слоям без циклов.'));
    }

    // 6. Автоматическое создание базовых инвариантов со стражами по найденным тестам
    const invariants = [];
    const allCodeFiles = walkCodeFiles(rootDir);
    const guardTests = allCodeFiles
      .filter((f) => /guard\.test\.|window-state\.test\.|memory\.test\.|store\.test\.|api\.test\./.test(f))
      .map((f) => path.relative(rootDir, f));

    if (guardTests.length > 0) {
      invariants.push(
        invariant('INV-GUARD-01', 'Ключевые тесты-стражи архитектуры присутствуют в репозитории', decisions[0].id, {
          why: 'Автоматически обнаруженные охранные тесты при сканировании репозитория.',
          guard: guardTests.join(', '),
          scope: rawModules.map((m) => m.id),
          rules: [{ kind: 'file-exists', paths: guardTests, message: 'Охранные тесты репозитория на месте' }],
        })
      );
    } else {
      invariants.push(
        invariant('INV-ARCH-01', 'Соблюдение границ слоёв модулей', decisions[0].id, {
          why: 'Модули нижнего слоя не должны импортировать модули верхних слоёв.',
          guard: 'Logos.verifyRepo (проверка импортов)',
          scope: rawModules.map((m) => m.id),
          rules: [],
        })
      );
    }

    const modules = rawModules
      .sort((a, b) => a.layer - b.layer || a.id.localeCompare(b.id))
      .map((m) =>
        moduleDef(m.id, m.title, m.layer, {
          layerName: m.layer === 0 ? 'Фундамент (слой 0)' : `Уровень ${m.layer}`,
          role: m.role,
          pkg: m.pkg,
          path: m.path,
          files: m.files,
          deps: m.deps,
          testDeps: m.testDeps,
        })
      );

    return project(
      { id: repoId, title, summary },
      {
        repo: {
          root: rootDir,
          stack: Array.from(stack),
          requiredFiles,
          requiredScripts,
          decisionsDir,
        },
        terms: [],
        decisions,
        invariants,
        modules,
        sockets: [],
        states: [],
        transitions: [],
        protocols: [],
        algorithms: [],
      }
    );
  }

  function formatModelCode(proj, globalName) {
    const gName = globalName || 'DiscoveredModel';
    return [
      `/* Автоматически снятая модель Logos.discoverRepo для «${proj.title}» (${proj.repo && proj.repo.root}) */`,
      `(function (root, factory) {`,
      `  if (typeof module === 'object' && module.exports) {`,
      `    const Lg = require('../logos.js');`,
      `    module.exports = factory(Lg);`,
      `  } else {`,
      `    root.${gName} = factory(root.Logos);`,
      `  }`,
      `})(typeof self !== 'undefined' ? self : this, function (Lg) {`,
      `  'use strict';`,
      `  const raw = ${JSON.stringify(proj, null, 2)};`,
      `  return Lg.project({ id: raw.id, title: raw.title, summary: raw.summary }, raw);`,
      `});`,
      ``,
    ].join('\n');
  }

  const HELP = {
    overview: [
      'Logos 1.2 — фреймворк кристаллизации архитектуры: единая база инвариантов, структуры файлов, состояний и схем (ДРАКОН + Дорожки).',
      'Два контура автоматической проверки:',
      '  1. Logos.lint(project) — проверяет саму модель (связность решений, инвариантов, слоёв, сокетов, автомата состояний, схем Drakon и Lanes).',
      '  2. Logos.verifyRepo(project, repoRoot) — сверяет модель с реальным кодом на диске (package.json, дерево пакетов, все import/export по слоям, регулярные стражи кода).',
      '',
      'Команды CLI (cli.js):',
      '  node cli.js check              — прогнать lint + verifyRepo и обновить снимок для браузера',
      '  node cli.js brief [moduleId]   — вывести контракт-прошивку для ИИ-агента',
      '  node cli.js judge [moduleId]   — вывести директиву на устранение найденных нарушений',
      '  node cli.js help [all]         — показать справку',
    ].join('\n'),
    rules: [
      'ПРАВИЛА СВЕРКИ МОДЕЛИ И КОДА (Logos.verifyRepo)',
      '- Каждый пакет в packages/* на диске обязан быть описан в project.modules, и наоборот.',
      '- Боевой код модуля A может импортировать @keel/B только если B указан в A.deps (и B лежит на том же или более низком слое).',
      '- Импорты в *.test.ts и bench проверяются против A.deps ∪ A.testDeps.',
      '- Если package.json содержит зависимость @keel/B, которой нет в боевых импортах и A.deps, выдаётся предупреждение о лишней зависимости.',
      '- Декларативные правила инвариантов (file-exists, forbid-regex, require-regex) исполняются прямо по исходникам репозитория.',
    ].join('\n'),
  };

  function help(topic) {
    if (!topic || topic === 'overview') return HELP.overview;
    if (topic === 'all') return [HELP.overview, HELP.rules].join('\n\n');
    return HELP[topic] || HELP.overview;
  }

  return {
    term,
    decision,
    invariant,
    moduleDef,
    socket,
    state,
    transition,
    project,
    lint,
    verifyRepo,
    discoverRepo,
    formatModelCode,
    layersSvg,
    statesSvg,
    brief,
    judge,
    report,
    help,
    Drakon,
    Lanes,
  };
});
