#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const Lg = require('./logos.js');
const KeelModel = require('./examples/keel-model.js');

const cmd = process.argv[2] || 'check';
const arg = process.argv[3];

function writeSnapshot(verifyData) {
  const snapPath = path.join(__dirname, 'examples', 'keel-verify-snapshot.js');
  const content =
    '/* Автоматический снимок сверки Logos.verifyRepo для браузерного пульта (index.html) */\n' +
    'window.KeelVerifySnapshot = ' +
    JSON.stringify(verifyData, null, 2) +
    ';\n';
  fs.writeFileSync(snapPath, content, 'utf8');
}

if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
  console.log(Lg.help(arg || 'all'));
  process.exit(0);
}

if (cmd === 'brief') {
  console.log(Lg.brief(KeelModel, arg || undefined));
  process.exit(0);
}

if (cmd === 'judge') {
  const v = Lg.verifyRepo(KeelModel);
  writeSnapshot(v);
  console.log(Lg.judge(KeelModel, v, arg || undefined));
  process.exit(0);
}

if (cmd === 'hook-context') {
  const v = Lg.verifyRepo(KeelModel);
  writeSnapshot(v);
  console.log('<logos-architecture-contract>');
  console.log(Lg.brief(KeelModel, arg || undefined));
  if (v.findings.length > 0) {
    console.log('\n' + Lg.judge(KeelModel, v, arg || undefined));
  }
  console.log('</logos-architecture-contract>');
  process.exit(0);
}

if (cmd === 'init' || cmd === 'discover') {
  const targetRepo = arg || '/mnt/Projects/apps/keel';
  const discovered = Lg.discoverRepo(targetRepo);
  const outName = process.argv[4] || `discovered-${discovered.id}.js`;
  const outPath = path.join(__dirname, 'examples', outName);
  fs.writeFileSync(outPath, Lg.formatModelCode(discovered), 'utf8');
  console.log(`✓ Авто-сканирование (0% ИИ) завершено: модель сохранена в examples/${outName}\n`);
  console.log(Lg.report(discovered, targetRepo));
  console.log('\nОбнаруженная карта слоёв и фактических зависимостей:');
  for (const m of discovered.modules) {
    console.log(
      `  [Слой ${m.layer}] ${m.id.padEnd(18)} (${m.path}) → deps: [${m.deps.join(', ') || '—'}]` +
        (m.testDeps.length ? `, testDeps: [${m.testDeps.join(', ')}]` : '')
    );
  }
  process.exit(0);
}

if (cmd === 'check') {
  const v = Lg.verifyRepo(KeelModel);
  writeSnapshot(v);
  console.log(Lg.report(KeelModel));
  const strict = process.argv.includes('--strict');
  const modelErrs = Lg.lint(KeelModel).filter((i) => i.level === 'error').length;
  const repoErrs = v.findings.filter((f) => f.level === 'error').length;
  if (modelErrs > 0 || (strict && repoErrs > 0)) {
    process.exit(1);
  }
  process.exit(0);
}

console.error(`Неизвестная команда «${cmd}». Используйте: check | brief [модуль] | judge [модуль] | hook-context [модуль] | help`);
process.exit(2);
