#!/usr/bin/env node
/* mcp-server.js — MCP-сервер над командным слоем logos-api.js по протоколу JSON-RPC 2.0 (stdio).
   Без внешних зависимостей: подключается в .mcp.json для Claude Code и других ИИ-агентов. */
'use strict';

const readline = require('readline');
const Api = require('./logos-api.js');
const Lg = require('./logos.js');
const KeelModel = require('./examples/keel-model.js');

const TOOLS = [
  {
    name: 'logos_status',
    description: 'Проверить целостность архитектурной модели Logos и сверить её с живым репозиторием на диске.',
    inputSchema: {
      type: 'object',
      properties: {
        repoRoot: { type: 'string', description: 'Путь к проверяемому репозиторию (по умолчанию Keel)' },
      },
    },
  },
  {
    name: 'logos_verify_unit',
    description: 'Проверить модуль «Скелет + Колбэки»: привязки икон ДРАКОН, контрактные тесты на deepFreeze и отсутствие скрытых состояний в impl/.',
    inputSchema: {
      type: 'object',
      properties: {
        unitDir: { type: 'string', description: 'Путь к каталогу модуля скелета (по умолчанию examples/nav-skeleton)' },
      },
    },
  },
  {
    name: 'logos_slot_brief',
    description: 'Получить изолированное ТЗ на реализацию одного колбэка (вход, выход, ограничения чистоты и тест-кейсы) без показа остальной системы.',
    inputSchema: {
      type: 'object',
      properties: {
        unitDir: { type: 'string', description: 'Путь к каталогу модуля скелета' },
        slotId: { type: 'string', description: 'Идентификатор гнезда колбэка (например, canSwitchTab или applyOpen)' },
      },
      required: ['slotId'],
    },
  },
  {
    name: 'logos_check_slot',
    description: 'Проверить код кандидата-колбэка ДО записи (М11): страж чистоты (0 let/var/class/this/DOM) и прогон всех контрактных тестов на замороженных данных.',
    inputSchema: {
      type: 'object',
      properties: {
        unitDir: { type: 'string', description: 'Путь к каталогу модуля скелета' },
        slotId: { type: 'string', description: 'Идентификатор гнезда колбэка' },
        fnCode: { type: 'string', description: 'Код чистой функции (state, bag, world) => ...' },
      },
      required: ['slotId', 'fnCode'],
    },
  },
  {
    name: 'logos_simulate',
    description: 'Прогнать сценарий через исполняемую схему ДРАКОН (Logos.Runtime.run) и получить трассу по иконам, новое состояние и команды портов.',
    inputSchema: {
      type: 'object',
      properties: {
        unitDir: { type: 'string', description: 'Путь к каталогу модуля скелета' },
        scenarioId: { type: 'string', description: 'ID сценария из 1-schema.js' },
      },
    },
  },
  {
    name: 'logos_scaffold',
    description: 'Сгенерировать с нуля рабочий канонический скелет проекта/модуля (1-schema, 2-plan, 3-contracts, impl/ с моками и автотест).',
    inputSchema: {
      type: 'object',
      properties: {
        targetDir: { type: 'string', description: 'Целевой каталог нового проекта' },
        id: { type: 'string', description: 'Короткий идентификатор проекта' },
        title: { type: 'string', description: 'Человекочитаемое название проекта' },
        summary: { type: 'string', description: 'Краткое описание назначения' },
      },
      required: ['targetDir', 'id'],
    },
  },
  {
    name: 'logos_brief',
    description: 'Выгрузить архитектурный контракт (прошивку) по модулю проекта.',
    inputSchema: {
      type: 'object',
      properties: {
        moduleId: { type: 'string', description: 'ID модуля (например, core, store, api, app)' },
      },
    },
  },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handleCallTool(name, args) {
  if (name === 'logos_status') return Api.status(args).reportText;
  if (name === 'logos_verify_unit') return JSON.stringify(Api.verifyUnit(args), null, 2);
  if (name === 'logos_slot_brief') return Api.slotBrief(args);
  if (name === 'logos_check_slot') return JSON.stringify(Api.checkSlotCandidate(args), null, 2);
  if (name === 'logos_simulate') return JSON.stringify(Api.simulate(args), null, 2);
  if (name === 'logos_scaffold') return JSON.stringify(Api.scaffoldProject(args), null, 2);
  if (name === 'logos_brief') return Lg.brief(KeelModel, args && args.moduleId);
  throw new Error(`Неизвестный инструмент MCP: ${name}`);
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch (_e) {
    return;
  }
  if (req.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'logos-mcp', version: '1.2.0' },
      },
    });
  } else if (req.method === 'tools/list') {
    send({
      jsonrpc: '2.0',
      id: req.id,
      result: { tools: TOOLS },
    });
  } else if (req.method === 'tools/call') {
    try {
      const p = req.params || {};
      const outText = handleCallTool(p.name, p.arguments || {});
      send({
        jsonrpc: '2.0',
        id: req.id,
        result: { content: [{ type: 'text', text: String(outText) }] },
      });
    } catch (err) {
      send({
        jsonrpc: '2.0',
        id: req.id,
        result: { isError: true, content: [{ type: 'text', text: err.message }] },
      });
    }
  } else if (req.id !== undefined) {
    send({ jsonrpc: '2.0', id: req.id, result: {} });
  }
});
