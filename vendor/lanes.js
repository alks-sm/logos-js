/* Lanes — «дорожки и время»: схема взаимодействия участников во времени, SVG. Без зависимостей, обычный скрипт
   (работает и с file://): задаёт глобальный `Lanes`, в node — module.exports. Вид — lanes.css (токены --ln-*).

   Схема — данные: участники (дорожки, слева направо) и шаги (время идёт вниз): сообщения, ответы, действия на дорожке,
   этапы и рамки «повтор / если / необязательно». Раскладка детерминированная: одна строка — один шаг, стрелки между
   собой не пересекаются (они лишь пересекают линии жизни дорожек), всё на одной странице.

   СПРАВКА — В САМОМ API, движок читать не нужно (людям и нейросетям):
     Lanes.help()            — обзор: модель схемы, быстрый старт, все функции, список разделов;
     Lanes.help('say')       — одна функция: аргументы, результат, пример, подводные камни;
     Lanes.help('rules' | 'recipes' | 'lint' | 'scope' | 'page' | 'node' | 'example' | 'all') — разделы;
     Lanes.api               — то же структурно: { имя: { sig, does, args, returns, example, notes } }.
   В node: console.log(require('./lanes.js').help('all')). */
(function (global) {
  'use strict';

  const VERSION = '1.0';
  const KINDS_OF_LANE = ['human', 'app', 'store', 'ext'];

  const DEFAULTS = {
    lane: 230, // ширина дорожки
    margin: 16, // поля схемы
    gap: 9, // промежуток между строками
    line: 15, // высота строки текста
    pad: 8, // поле текста в блоке сверху и снизу
    boxInset: 60, // блок действия уже дорожки на столько
    repeatHeaderAfter: 520, // схема выше этого — шапки дорожек повторяются внизу
    font: '12.5px "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  };

  let meter = null;
  function measurer(font) {
    if (typeof document === 'undefined') return (s) => s.length * 6.6;
    if (!meter) meter = document.createElement('canvas').getContext('2d');
    return (s) => { meter.font = font; return meter.measureText(s).width; };
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NEGATION = /(^|[\s,(«])(не|нет|без|ни)([\s,?»)]|$)/i;

  // ─── конструкторы ─────────────────────────────────────────────────────────
  const kind = (k) => (k ? { k } : {});
  const num = (n) => (n ? { n } : {});
  /** Дорожка: участник. kind — 'human' | 'app' | 'store' | 'ext'. */
  const lane = (id, name, kindOfLane, sub) => ({ id, name, kind: kindOfLane || 'app', sub: sub || '' });
  /** Сообщение: сплошная стрелка от одной дорожки к другой. */
  const say = (from, to, text, k, n) => ({ t: 'say', from, to, text, ...kind(k), ...num(n) });
  /** Ответ: пунктирная стрелка обратно (результат вызова). */
  const back = (from, to, text, k, n) => ({ t: 'back', from, to, text, ...kind(k), ...num(n) });
  /** Действие на дорожке: блок, участник делает что-то сам. */
  const act = (laneId, text, k, n) => ({ t: 'act', lane: laneId, text, ...kind(k), ...num(n) });
  /** Этап: полоса через всю схему. */
  const phase = (text, n) => ({ t: 'phase', text, ...num(n) });
  /** Повтор: рамка «для каждого …». */
  const loop = (text, steps) => ({ t: 'loop', text, steps });
  /** Необязательно: рамка «если нужно …». */
  const opt = (text, steps) => ({ t: 'opt', text, steps });
  /** Если: рамка с ветками. branches — [{ label, steps, stop? }]. */
  const alt = (text, branches) => ({ t: 'alt', text, branches });
  /** Схема. */
  const sequence = (title, { lanes, steps, notes } = {}) => ({ kind: 'sequence', title, lanes: lanes || [], steps: steps || [], notes: notes || [] });

  // ─── проверка ─────────────────────────────────────────────────────────────
  const MAX_LANES = 6, MAX_ROWS = 40, MAX_DEPTH = 3, MAX_TEXT = 90;

  function lint(d) {
    const out = [];
    const add = (level, where, message) => out.push({ level, where, message });
    if (!d || d.kind !== 'sequence') { add('error', 'схема', 'Это не Lanes.sequence(…): kind должен быть "sequence".'); return out; }
    const ids = new Set();
    if (!d.lanes.length) add('error', 'дорожки', 'Нет ни одной дорожки.');
    if (d.lanes.length > MAX_LANES) add('warn', 'дорожки', `Дорожек ${d.lanes.length}: больше ${MAX_LANES} читается тяжело. Объедините участников или разделите схему по этапам.`);
    for (const l of d.lanes) {
      if (!l.id || !l.name) add('error', 'дорожки', 'У дорожки нет id или имени.');
      if (ids.has(l.id)) add('error', `дорожка «${l.id}»`, 'Такой id уже есть.');
      ids.add(l.id);
      if (!KINDS_OF_LANE.includes(l.kind)) add('error', `дорожка «${l.id}»`, `Неизвестный вид «${l.kind}»: ${KINDS_OF_LANE.join(', ')}.`);
    }
    if (!d.steps.length) add('error', 'шаги', 'Нет ни одного шага.');
    const used = new Set(), calls = new Set();
    let rows = 0, msgs = 0, longs = 0;
    const idx = new Map(d.lanes.map((l, i) => [l.id, i]));
    const needLane = (id, where) => { if (!ids.has(id)) { add('error', where, `Нет дорожки «${id}».`); return false; } used.add(id); return true; };
    const textOf = (it, where) => {
      if (!it.text || !String(it.text).trim()) add('error', where, 'Пустая подпись.');
      else if (String(it.text).length > MAX_TEXT) add('warn', where, `Подпись длиннее ${MAX_TEXT} знаков: сократите, подробности — в примечание (n).`);
    };
    function walk(items, depth, path) {
      items.forEach((it, i) => {
        const where = `${path}${i + 1}`;
        if (it.t === 'phase') {
          rows++; textOf(it, `${where} этап`);
          if (depth > 0) add('warn', `${where} этап`, 'Этап внутри рамки: полоса через всю схему ломает рамку. Вынесите этап наружу.');
        } else if (it.t === 'act') {
          rows++; textOf(it, `${where} действие`);
          needLane(it.lane, `${where} действие`);
        } else if (it.t === 'say' || it.t === 'back') {
          rows++; msgs++; const w = `${where} ${it.t === 'say' ? 'сообщение' : 'ответ'}`;
          textOf(it, w);
          const a = needLane(it.from, w), b = needLane(it.to, w);
          if (a && b) {
            if (it.from === it.to) add('error', w, 'Сообщение самому себе: это действие, пишите act(дорожка, текст).');
            if (it.t === 'say') calls.add(`${it.from}>${it.to}`);
            else if (!calls.has(`${it.to}>${it.from}`)) add('warn', w, 'Ответ без вызова: раньше не было сообщения в обратную сторону. Это настоящий ответ или потерянный say?');
            if (d.lanes.length > 3 && Math.abs(idx.get(it.from) - idx.get(it.to)) >= 2) longs++;
          }
        } else if (it.t === 'loop' || it.t === 'opt' || it.t === 'alt') {
          const w = `${where} ${it.t === 'loop' ? 'повтор' : it.t === 'opt' ? 'необязательно' : 'если'}`;
          textOf(it, w);
          if (depth + 1 > MAX_DEPTH) add('warn', w, `Рамки вложены глубже ${MAX_DEPTH}: схема тонет. Разделите на две.`);
          if (it.t === 'alt') {
            if (!it.branches || it.branches.length < 2) add('warn', w, 'В рамке «если» меньше двух веток: для одной используйте opt(…).');
            const negated = NEGATION.test(String(it.text || ''));
            (it.branches || []).forEach((b, bi) => {
              const bw = `${w}, ветка ${bi + 1}`;
              if (!b.label || !String(b.label).trim()) add('error', bw, 'У ветки нет подписи (label).');
              else if (negated && /^(да|нет)[.!]?$/i.test(String(b.label).trim()))
                add('warn', bw, 'Вопрос с отрицанием, а ветка — голое «да»/«нет». Пиши с пояснением: «да, не совпадают» / «нет, совпадают».');
              if (!b.steps || !b.steps.length) { if (!b.stop) add('error', bw, 'Пустая ветка.'); }
              else walk(b.steps, depth + 1, bw + ' · ');
              if (b.stop && !(b.steps && b.steps.length)) add('warn', bw, 'Ветка stop без шагов: покажите, что произошло перед отказом.');
            });
          } else {
            if (!it.steps || !it.steps.length) add('error', w, 'Пустая рамка.');
            else walk(it.steps, depth + 1, w + ' · ');
          }
        } else add('error', where, `Неизвестный шаг «${it.t}».`);
      });
    }
    walk(d.steps, 0, '');
    if (rows > MAX_ROWS) add('warn', 'шаги', `Строк ${rows}: больше ${MAX_ROWS} — делите схему по этапам на две, стык — общий шаг.`);
    for (const l of d.lanes) if (!used.has(l.id)) add('warn', `дорожка «${l.id}»`, 'Дорожка не участвует ни в одном шаге: уберите её.');
    if (msgs >= 4 && longs / msgs > 0.4) add('warn', 'дорожки', 'Больше 40% стрелок перелетают через дорожку. Переставьте дорожки так, чтобы собеседники стояли рядом.');
    return out;
  }

  // ─── раскладка и SVG ──────────────────────────────────────────────────────
  function svg(d, options) {
    const cfg = Object.assign({}, DEFAULTS, options || {});
    for (const f of lint(d)) (f.level === 'error' ? console.error : console.warn)(`Lanes «${d && d.title}»: ${f.where}: ${f.message}`);
    const m = measurer(cfg.font);
    const W = cfg.lane, M = cfg.margin, LH = cfg.line;
    const n = d.lanes.length, width = M * 2 + W * n;
    const idx = new Map(d.lanes.map((l, i) => [l.id, i]));
    const ix = (id) => (idx.has(id) ? idx.get(id) : 0);
    const cx = (i) => M + W * (i + 0.5);
    const boxW = W - cfg.boxInset;

    function wrap(text, maxW) {
      const words = String(text).split(/\s+/).filter(Boolean), lines = [];
      let cur = '';
      for (let w of words) {
        while (m(w) > maxW && w.length > 1) { // слишком длинное слово — режем
          let k = w.length - 1;
          while (k > 1 && m(w.slice(0, k)) > maxW) k--;
          if (cur) { lines.push(cur); cur = ''; }
          lines.push(w.slice(0, k)); w = w.slice(k);
        }
        const t = cur ? cur + ' ' + w : w;
        if (cur && m(t) > maxW) { lines.push(cur); cur = w; } else cur = t;
      }
      if (cur) lines.push(cur);
      return lines.length ? lines : [''];
    }
    const textLines = (lines, x, y, cls, anchor) =>
      lines.map((s, i) => `<text class="${cls}" x="${x}" y="${y + i * LH}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`).join('');
    const badge = (x, y, nn) => `<circle class="ln-badge" cx="${x}" cy="${y}" r="8"/><text class="ln-badge-t" x="${x}" y="${y + 3.5}" text-anchor="middle">${nn}</text>`;
    const kcls = (k) => (k ? ` ln-${k}` : '');

    // шапки дорожек
    const head = d.lanes.map((l) => {
      const inner = W - 28 - 20 - (l.kind === 'human' ? 22 : 0);
      return { name: wrap(l.name, inner).slice(0, 3), sub: l.sub ? wrap(l.sub, inner).slice(0, 2) : [] };
    });
    const headH = Math.max(46, ...head.map((h, i) => 18 + h.name.length * LH + h.sub.length * 14 + 8 + (d.lanes[i].kind === 'store' ? 10 : 0)));
    function drawHead(i, top) {
      const l = d.lanes[i], h = head[i], w = W - 28, x = cx(i) - w / 2, mid = l.kind === 'human' ? cx(i) + 11 : cx(i);
      let shape;
      if (l.kind === 'human') shape = `<rect class="ln-head" x="${x}" y="${top}" width="${w}" height="${headH}" rx="${Math.min(22, headH / 2)}"/>` +
        `<circle class="ln-glyph" cx="${x + 20}" cy="${top + headH / 2 - 5}" r="4.5"/><path class="ln-glyph" d="M${x + 11},${top + headH / 2 + 10} q0,-9 9,-9 q9,0 9,9 z"/>`;
      else if (l.kind === 'store') shape = `<path class="ln-head" d="M${x},${top + 8} a${w / 2},8 0 0 1 ${w},0 v${headH - 16} a${w / 2},8 0 0 1 -${w},0 z"/>` +
        `<path class="ln-head-top" d="M${x},${top + 8} a${w / 2},8 0 0 0 ${w},0"/>`;
      else if (l.kind === 'ext') shape = `<rect class="ln-head" x="${x}" y="${top}" width="${w}" height="${headH}" rx="4"/>` +
        `<rect class="ln-head-in" x="${x + 3.5}" y="${top + 3.5}" width="${w - 7}" height="${headH - 7}" rx="2"/>`;
      else shape = `<rect class="ln-head" x="${x}" y="${top}" width="${w}" height="${headH}" rx="6"/>`;
      const ty = top + (l.kind === 'store' ? 20 : 10) + 11 + ((headH - 18 - h.name.length * LH - h.sub.length * 14 - 8 - (l.kind === 'store' ? 10 : 0)) / 2);
      return shape + textLines(h.name, mid, ty, 'ln-hn', 'middle') + textLines(h.sub, mid, ty + h.name.length * LH + 1, 'ln-hs', 'middle');
    }

    const titleY = M + 10, headTop = M + 24;
    let y = headTop + headH + 16;
    const back_ = [], front = [];
    let last = null;

    function spanOf(items) {
      let lo = Infinity, hi = -Infinity;
      const touch = (i) => { if (i < lo) lo = i; if (i > hi) hi = i; };
      const merge = (s) => { if (s) { touch(s.lo); touch(s.hi); } };
      for (const it of items) {
        if (it.t === 'say' || it.t === 'back') { touch(ix(it.from)); touch(ix(it.to)); }
        else if (it.t === 'act') touch(ix(it.lane));
        else if (it.t === 'loop' || it.t === 'opt') merge(spanOf(it.steps || []));
        else if (it.t === 'alt') for (const b of it.branches || []) merge(spanOf(b.steps || []));
      }
      return lo === Infinity ? null : { lo, hi };
    }

    function frame(it, kw, branches, depth) {
      let lo = Infinity, hi = -Infinity;
      for (const b of branches) { const s = spanOf(b.steps || []); if (s) { lo = Math.min(lo, s.lo); hi = Math.max(hi, s.hi); } }
      if (lo === Infinity) { lo = 0; hi = n - 1; }
      const left = cx(lo) - W / 2 + 4 + 7 * depth, right = cx(hi) + W / 2 - 4 - 7 * depth, fw = right - left;
      const top = y;
      const lines = wrap(`${kw} · ${it.text}`, fw - 18);
      front.push(lines.map((s, i) => {
        const bold = i === 0 ? s.slice(0, kw.length) : '';
        const rest = i === 0 ? s.slice(kw.length) : s;
        return `<text class="ln-fkw" x="${left + 9}" y="${y + 15 + i * LH}">${bold ? `<tspan class="ln-fk">${esc(bold)}</tspan>` : ''}${esc(rest)}</text>`;
      }).join(''));
      y += lines.length * LH + 8;
      branches.forEach((b, bi) => {
        if (b.label) {
          if (bi > 0) { y += 3; front.push(`<line class="ln-div" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/>`); }
          const bl = wrap(b.label, fw - 18);
          front.push(textLines(bl, left + 9, y + 13, 'ln-blabel'));
          y += bl.length * LH + 4;
        }
        last = null;
        place(b.steps || [], depth + 1);
        if (b.stop) { // ветка обрывается: дальше по этому пути не идём
          const x = last == null ? cx(lo) : cx(last);
          front.push(`<path class="ln-stopx" d="M${x - 6},${y + 1} l12,12 m0,-12 l-12,12"/>`);
          y += 18;
        }
      });
      y += 4;
      back_.push(`<rect class="ln-frame ln-frame-${it.t}" x="${left}" y="${top}" width="${fw}" height="${y - top}" rx="5"/>`);
      y += cfg.gap;
    }

    function place(items, depth) {
      for (const it of items) {
        if (it.t === 'phase') {
          front.push(`<rect class="ln-phase" x="${M / 2}" y="${y}" width="${width - M}" height="24" rx="4"/>` +
            `<text class="ln-phase-t" x="${M / 2 + 12}" y="${y + 16}">${esc(it.text)}</text>` + (it.n ? badge(width - M / 2 - 14, y + 12, it.n) : ''));
          y += 24 + cfg.gap; last = null;
        } else if (it.t === 'act') {
          const lines = wrap(it.text, boxW - 16), h = lines.length * LH + 2 * cfg.pad, x = cx(ix(it.lane)) - boxW / 2;
          front.push(`<rect class="ln-box${kcls(it.k)}" x="${x}" y="${y}" width="${boxW}" height="${h}" rx="6"/>` +
            textLines(lines, cx(ix(it.lane)), y + cfg.pad + 11, 'ln-t', 'middle') + (it.n ? badge(x + boxW, y, it.n) : ''));
          y += h + cfg.gap; last = ix(it.lane);
        } else if (it.t === 'say' || it.t === 'back') {
          const a = ix(it.from), b = ix(it.to), x1 = cx(a), x2 = cx(b), dir = x2 >= x1 ? 1 : -1, span = Math.abs(x2 - x1) || W;
          const lines = wrap(it.text, Math.max(span - 24, 90)), lh = lines.length * LH;
          const ay = y + lh + 10, mx = (x1 + x2) / 2, ex = x2;
          const head_ = it.t === 'say'
            ? `<polygon class="ln-ah${kcls(it.k)}" points="${ex},${ay} ${ex - dir * 9},${ay - 4.5} ${ex - dir * 9},${ay + 4.5}"/>`
            : `<polyline class="ln-ao${kcls(it.k)}" points="${ex - dir * 9},${ay - 4.5} ${ex},${ay} ${ex - dir * 9},${ay + 4.5}"/>`;
          front.push(`<line class="ln-msg ln-msg-${it.t}${kcls(it.k)}" x1="${x1}" y1="${ay}" x2="${ex - dir * 1}" y2="${ay}"/>` + head_ +
            textLines(lines, mx, y + 11, 'ln-lbl' + (it.k ? ` ln-t-${it.k}` : ''), 'middle') +
            (it.n ? badge(Math.min(x1, x2) + 12, y + 7, it.n) : ''));
          y += lh + 10 + 8 + cfg.gap; last = b;
        } else if (it.t === 'loop') frame(it, 'повтор', [{ steps: it.steps }], depth);
        else if (it.t === 'opt') frame(it, 'если нужно', [{ steps: it.steps }], depth);
        else if (it.t === 'alt') frame(it, 'если', it.branches || [], depth);
      }
    }

    place(d.steps, 0);
    const bottomHeads = y - headTop > cfg.repeatHeaderAfter;
    const bodyEnd = y;
    const height = bottomHeads ? bodyEnd + headH + 6 + M : bodyEnd + M;
    const lifelines = d.lanes.map((l, i) => `<line class="ln-life" x1="${cx(i)}" y1="${headTop + headH}" x2="${cx(i)}" y2="${bottomHeads ? bodyEnd : height - M}"/>`).join('');
    const heads = d.lanes.map((_, i) => drawHead(i, headTop)).join('') + (bottomHeads ? d.lanes.map((_, i) => drawHead(i, bodyEnd)).join('') : '');
    return `<svg class="ln" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(d.title)}">` +
      `<title>${esc(d.title)}</title><text class="ln-title" x="${M}" y="${titleY}">${esc(d.title)}</text>` +
      lifelines + back_.join('') + heads + front.join('') + '</svg>';
  }

  /** Схема в контейнер: поле с прокруткой, кнопка «Вписать по ширине» и примечания списком. */
  function figure(container, d, options) {
    const o = Object.assign({ fit: true, notes: true }, options || {});
    let body;
    try { body = svg(d, o); } catch (e) { body = `<p class="ln-fail">Схема не нарисовалась: ${esc(e.message)}</p>`; }
    const notes = o.notes && d.notes && d.notes.length ? `<ol class="ln-notes">${d.notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : '';
    container.innerHTML = (o.fit ? '<div class="ln-bar"><button type="button" class="ln-fit">Вписать по ширине</button></div>' : '') +
      `<div class="ln-canvas">${body}</div>` + notes;
    const btn = container.querySelector('.ln-fit');
    if (btn) btn.addEventListener('click', () => {
      const on = container.querySelector('.ln-canvas').classList.toggle('ln-fitted');
      btn.textContent = on ? 'В натуральную величину' : 'Вписать по ширине';
    });
    return container;
  }

  /** Обозначения: виды дорожек, стрелки, рамки и, если даны, виды — { new: 'решение — сделать', … }. HTML строкой. */
  function legend(kinds) {
    const s = (w, h, inner) => `<svg class="ln" width="${w}" height="${h}" aria-hidden="true">${inner}</svg>`;
    const fig = (inner, text) => `<figure>${inner}<figcaption>${esc(text)}</figcaption></figure>`;
    const items = [
      fig(s(40, 24, '<circle class="ln-glyph" cx="12" cy="9" r="4"/><path class="ln-glyph" d="M4,21 q0,-8 8,-8 q8,0 8,8 z"/>'), 'человек'),
      fig(s(40, 24, '<rect class="ln-head" x="3" y="3" width="34" height="18" rx="5"/>'), 'программа, процесс'),
      fig(s(40, 24, '<path class="ln-head" d="M3,7 a17,5 0 0 1 34,0 v10 a17,5 0 0 1 -34,0 z"/><path class="ln-head-top" d="M3,7 a17,5 0 0 0 34,0"/>'), 'хранилище: диск, шара'),
      fig(s(40, 24, '<rect class="ln-head" x="3" y="3" width="34" height="18" rx="3"/><rect class="ln-head-in" x="6" y="6" width="28" height="12" rx="1.5"/>'), 'чужая система'),
      fig(s(44, 24, '<line class="ln-msg" x1="2" y1="12" x2="36" y2="12"/><polygon class="ln-ah" points="40,12 31,7.5 31,16.5"/>'), 'сообщение, вызов'),
      fig(s(44, 24, '<line class="ln-msg ln-msg-back" x1="2" y1="12" x2="38" y2="12"/><polyline class="ln-ao" points="9,7.5 2,12 9,16.5"/>'), 'ответ, результат'),
      fig(s(40, 24, '<rect class="ln-box" x="4" y="4" width="32" height="16" rx="4"/>'), 'действие на дорожке'),
      fig(s(40, 24, '<rect class="ln-frame" x="3" y="3" width="34" height="18" rx="4"/>'), 'рамка: повтор / если / если нужно'),
      fig(s(40, 24, '<path class="ln-stopx" d="M12,6 l16,12 m0,-12 l-16,12"/>'), 'ветка оборвана'),
    ];
    for (const [k, text] of Object.entries(kinds || {}))
      items.push(fig(s(40, 24, `<rect class="ln-box ln-${k}" x="4" y="4" width="32" height="16" rx="4"/>`), text));
    return `<div class="ln-legend">${items.join('')}</div>`;
  }

  // ─── справка ──────────────────────────────────────────────────────────────
  const KINDS = "вид k: 'new' — решено, сделать; 'ask' — вопрос владельцу; 'human' — делает человек; 'stop' — отказ, откат; любое другое слово — CSS-класс ln-<слово>; опустить — обычный";
  const NOTE_N = 'номер примечания (1, 2, …): кружок на шаге; текст — notes[n-1] схемы';

  const API = {
    lane: {
      sig: 'lane(id, name, kind?, sub?)',
      does: 'Дорожка — участник. Дорожки стоят слева направо в порядке массива lanes.',
      args: [['id', "короткий идентификатор, по нему шаги ссылаются на дорожку: 'app'"], ['name', "имя в шапке: 'Окно Toolbelt'"],
        ['kind', "'human' (человек) | 'app' (программа, по умолчанию) | 'store' (диск, шара, база) | 'ext' (чужая система)"], ['sub', 'мелкая подпись под именем: роль или где живёт']],
      returns: '{ id, name, kind, sub }',
      example: "L.lane('hum', 'Человек', 'human')\nL.lane('disk', 'Диск', 'store', 'шара проекта')",
      notes: ['Вид даёт форму шапки: человек — со значком, хранилище — цилиндр, чужая система — двойная рамка. Цвет форму не заменяет.',
        'Порядок дорожек важен: собеседники рядом, человек левее всех, хранилища правее всех. Иначе стрелки перелетают через чужие дорожки — lint ругается.'],
    },
    say: {
      sig: 'say(from, to, text, k?, n?)',
      does: 'Сообщение: сплошная стрелка с подписью от дорожки from к дорожке to. Это вызов, команда, запись, событие.',
      args: [['from', 'id дорожки-отправителя'], ['to', 'id дорожки-получателя (не та же самая)'], ['text', "подпись: глагол и предмет, 'Записать копию'"], ['k', KINDS], ['n', NOTE_N]],
      returns: "шаг { t: 'say', from, to, text, k, n }",
      example: "L.say('app', 'addin', 'Скопировать файлы по плану')\nL.say('app', 'disk', 'Перечитать папки', 'new', 1)",
      notes: ['Подпись над стрелкой переносится по ширине между дорожками; длиннее 90 знаков — warn, подробности вынесите в примечание.',
        'Стрелка не может быть направлена на себя: действие дорожки — act().'],
    },
    back: {
      sig: 'back(from, to, text, k?, n?)',
      does: 'Ответ: пунктирная стрелка обратно, результат вызова. Подпись — что вернулось.',
      args: [['from', 'кто отвечает'], ['to', 'кому'], ['text', "результат: 'Исход каждого файла'"], ['k', KINDS], ['n', NOTE_N]],
      returns: "шаг { t: 'back', from, to, text, k, n }",
      example: "L.back('addin', 'app', 'Исход каждого файла')",
      notes: ['Ответу должен предшествовать вызов в обратную сторону (say с теми же дорожками наоборот), иначе warn.'],
    },
    act: {
      sig: 'act(lane, text, k?, n?)',
      does: 'Действие на дорожке: блок, участник делает что-то сам, без обмена.',
      args: [['lane', 'id дорожки'], ['text', "'Проверить имена в плане'"], ['k', KINDS], ['n', NOTE_N]],
      returns: "шаг { t: 'act', lane, text, k, n }",
      example: "L.act('hum', 'Проверить план и нажать «Записать»', 'human')\nL.act('app', 'Откат', 'stop')",
      notes: ['Что человек делает руками — k: "human" (зелёный). Отказ и откат — k: "stop".'],
    },
    phase: {
      sig: 'phase(text, n?)',
      does: 'Этап: полоса через всю схему. Делит время на понятные куски, дополняет вертикаль.',
      args: [['text', "'1. Подготовка'"], ['n', NOTE_N]],
      returns: "шаг { t: 'phase', text, n }",
      example: "L.phase('Запись')",
      notes: ['Этап ставят только на верхнем уровне, не внутри рамки.', 'Этапы вместо отдельных окон: вся схема остаётся на одной странице.'],
    },
    loop: {
      sig: 'loop(text, steps)',
      does: "Рамка «повтор»: шаги внутри выполняются для каждого элемента. Рамка охватывает дорожки, которые в ней встречаются.",
      args: [['text', "'для каждого файла'"], ['steps', 'массив шагов внутри']],
      returns: "шаг { t: 'loop', text, steps }",
      example: "L.loop('для каждого файла', [L.say('addin', 'inv', 'Открыть'), L.say('addin', 'disk', 'Сохранить')])",
      notes: ['Пустая рамка — error. Рамки вкладываются, но глубже трёх — warn.'],
    },
    opt: {
      sig: 'opt(text, steps)',
      does: "Рамка «если нужно»: шаги выполняются только при условии. Для условия с двумя исходами — alt.",
      args: [['text', "условие: 'если папка новая'"], ['steps', 'шаги внутри']],
      returns: "шаг { t: 'opt', text, steps }",
      example: "L.opt('папка новая', [L.say('app', 'disk', 'Создать папку')])",
    },
    alt: {
      sig: 'alt(text, branches)',
      does: "Рамка «если» с ветками, разделёнными пунктиром. Каждая ветка — { label, steps, stop? }.",
      args: [['text', "вопрос: 'Записано всё?'"], ['branches', "[{ label: 'да, всё', steps: […] }, { label: 'нет, сбой', steps: […], stop: true }]"]],
      returns: "шаг { t: 'alt', text, branches }",
      example: "L.alt('Записано всё?', [\n  { label: 'да, всё', steps: [L.act('app', 'Журнал')] },\n  { label: 'нет, сбой', steps: [L.act('addin', 'Откат', 'stop')], stop: true },\n])",
      notes: ['label обязателен у каждой ветки. Вопрос с отрицанием — подписи с пояснением: «да, не совпадают» / «нет, совпадают» (lint следит).',
        'stop: true — после ветки по этому пути не идём: рисуется крестик. Остальные ветки продолжаются дальше по схеме.',
        'Одна ветка — это opt, не alt.'],
    },
    sequence: {
      sig: 'sequence(title, { lanes, steps, notes? })',
      does: 'Схема: заголовок, дорожки слева направо и шаги сверху вниз.',
      args: [['title', "название: 'Запись копии'"], ['lanes', 'массив lane(…)'], ['steps', 'массив шагов'], ['notes', 'тексты примечаний: notes[0] — кружок 1']],
      returns: "схема { kind: 'sequence', title, lanes, steps, notes }",
      example: "L.sequence('Печать', { lanes: [L.lane('h','Человек','human'), L.lane('a','Окно')], steps: [L.say('h','a','Нажать «Печать»'), L.back('a','h','Готово')] })",
    },
    svg: {
      sig: 'svg(d, options?)',
      does: 'Рисует схему, возвращает SVG строкой. Перед этим прогоняет lint и выводит замечания в console.',
      args: [['d', 'схема из sequence()'], ['options', 'размеры (lane, margin, gap, line, pad, boxInset, font) — см. Lanes.defaults']],
      returns: 'строка <svg …>',
      example: 'container.innerHTML = Lanes.svg(scheme)',
      notes: ['В node ширина текста приближённая (6,6 пикселя на знак), в браузере — по canvas.'],
    },
    figure: {
      sig: 'figure(container, d, options?)',
      does: 'Схема в контейнер: поле с прокруткой, кнопка «Вписать по ширине», примечания списком.',
      args: [['container', 'DOM-элемент'], ['d', 'схема'], ['options', '{ fit: false } — без кнопки, { notes: false } — без примечаний, плюс размеры svg()']],
      returns: 'container',
      example: "Lanes.figure(document.getElementById('out'), scheme)",
    },
    legend: {
      sig: 'legend(kinds?)',
      does: 'Обозначения: виды дорожек, стрелки, рамки; kinds — { new: "решение — сделать", … } добавляет цвета.',
      args: [['kinds', "словарь вид → подпись, например { human: 'делает человек', stop: 'отказ, откат' }"]],
      returns: 'HTML строкой',
      example: "el.innerHTML = Lanes.legend({ human: 'делает человек', stop: 'отказ, откат' })",
    },
    lint: {
      sig: 'lint(d)',
      does: 'Проверка схемы по правилам; возвращает [{ level: "error" | "warn", where, message }]. svg() вызывает её сам.',
      args: [['d', 'схема']],
      returns: 'массив замечаний, пустой — чисто',
      example: "const bad = Lanes.lint(scheme); if (bad.length) console.table(bad)",
      notes: ['error — схема нарисуется неверно или не нарисуется; warn — читается тяжело или нарушено правило.'],
    },
    help: {
      sig: 'help(topic?)',
      does: 'Справка строкой. Без аргумента — обзор.',
      args: [['topic', "имя функции ('say', 'Lanes.say', 'say()') или раздел: overview, rules, recipes, lint, scope, page, node, example, all"]],
      returns: 'строка',
      example: "console.log(Lanes.help('recipes'))",
    },
    defaults: {
      sig: 'defaults',
      does: 'Размеры по умолчанию: lane 230, margin 16, gap 9, line 15, pad 8, boxInset 60, repeatHeaderAfter 520, font.',
      returns: 'объект; передаётся options в svg() / figure() частично',
      example: "Lanes.svg(scheme, { lane: 260 })",
    },
  };

  const GUIDE = {
    overview: () => [
      `LANES ${VERSION} — схемы «дорожки и время»`,
      '',
      'Что это: участники стоят колонками (дорожками), время идёт сверху вниз, между участниками — стрелки-сообщения. Подходит для',
      'взаимодействия процессов (приложение ↔ надстройка ↔ программа ↔ диск), протоколов, порядка операций, «кто кого вызывает и когда».',
      'Не для логики решений внутри одного участника — там блок-схема (ДРАКОН).',
      '',
      'Модель: схема = заголовок + дорожки (lane) + шаги. Шаги: say (сообщение), back (ответ), act (действие), phase (этап),',
      'loop / opt / alt (рамки). Всё — данные; Lanes.svg(схема) отдаёт SVG, Lanes.lint(схема) проверяет.',
      '',
      'Быстрый старт:',
      "    const L = Lanes;",
      "    const s = L.sequence('Печать', {",
      "      lanes: [L.lane('h', 'Человек', 'human'), L.lane('a', 'Окно'), L.lane('p', 'Принтер', 'ext')],",
      "      steps: [L.say('h', 'a', 'Нажать «Печать»'), L.say('a', 'p', 'Отправить задание'), L.back('p', 'a', 'Принято'), L.back('a', 'h', 'Готово')],",
      '    });',
      "    Lanes.figure(document.getElementById('out'), s);   // или container.innerHTML = Lanes.svg(s)",
      '',
      'Функции: lane say back act phase loop opt alt sequence svg figure legend lint help. Разделы справки: overview rules recipes lint scope page node example all.',
    ].join('\n'),

    rules: () => [
      'ПРАВИЛА (откуда они)',
      'Опираются на исследования понимаемости нотаций; где есть только практика, сказано.',
      '- Время — вниз, участники — колонки. Информация лежит «по месту» — глазу не нужно искать (Larkin, Simon, 1987).',
      '- Стрелки не пересекаются между собой по построению: одна строка — один шаг. Пересекать линию жизни дорожки можно. Пересечения рёбер —',
      '  главный вред для чтения (Purchase и др.). Следите, чтобы стрелки не перелетали через чужие дорожки: переставьте дорожки.',
      '- Всё на одной странице. Этапы (phase) и рамки вместо отдельных окон: плоские модели в эксперименте понимались лучше вложенных (Türetken и др., 2020).',
      '- Размер: до 6 дорожек, до 40 строк (Mendling и др., 7PMG: мало элементов, большое делить). Больше — делите по этапам на две схемы, стык — общий шаг.',
      '- Малый алфавит: 4 вида дорожек, 2 вида стрелок, 3 вида рамок, 4 цвета. Разные формы, а не только разные цвета (Moody, Physics of Notations).',
      '- Подпись = слова + форма: текст на стрелке, форма шапки, значок человека. Один смысл — одно обозначение.',
      '- Порядок дорожек: человек левее всех, хранилища правее всех, собеседники рядом. Практика, не из исследований.',
      '- Подпись сообщения — глагол и предмет («Записать копию»); ответа — результат («Исход каждого файла»). Практика.',
      '- Вопрос с отрицанием в alt — подписи с пояснением: «да, не совпадают» / «нет, совпадают». Наше отступление, то же, что в ДРАКОН.',
      '- Схема привязана к источнику правды: пока дорожки и сообщения пишут руками, они расходятся с кодом (Petre, UML in Practice, 2013).',
      '  Держите схему рядом с кодом и называйте в ней то, что называется в коде.',
    ].join('\n'),

    recipes: () => [
      'РЕЦЕПТЫ',
      '1. Вызов и результат: say(a, b, "Сделать X") затем back(b, a, "Результат"). Ответ всегда после вызова.',
      '2. Цепочка через посредника: say(a, b, …); say(b, c, …); back(c, b, …); back(b, a, …). Дорожки a, b, c — подряд, иначе стрелки перелетят.',
      '3. Для каждого: loop("для каждого файла", [ шаги ]). Рамка охватывает только нужные дорожки.',
      '4. Успех или сбой: alt("Записано всё?", [{ label: "да, всё", steps: […] }, { label: "нет, сбой", steps: [act(…, "Откат", "stop")], stop: true }]).',
      '   stop: true рисует крестик — по этому пути дальше не идём; основной поток продолжается после рамки.',
      '5. Только иногда: opt("папка новая", [ шаги ]).',
      '6. Человек решает: act("hum", "Проверить и нажать «Записать»", "human") — зелёный блок на дорожке человека.',
      '7. Этапы: phase("1. План"), phase("2. Запись"), … Ставьте на верхнем уровне.',
      '8. Заметка к шагу: n: 1 и notes: ["…"] в схеме — кружок на шаге, текст ниже.',
      '9. Параллельно: не умеем (см. scope). Покажите последовательно и напишите в подписи «параллельно».',
    ].join('\n'),

    lint: () => [
      'ТАБЛИЦА ЗАМЕЧАНИЙ lint()',
      'error: схема неверна. warn: читается тяжело или нарушено правило.',
      '  error  Нет ни одной дорожки / шагов            — пустая схема.',
      '  error  Нет дорожки «id»                         — шаг ссылается на несуществующую дорожку; опечатка в id.',
      '  error  Сообщение самому себе                    — замените на act(дорожка, текст).',
      '  error  Пустая подпись / Пустая ветка / рамка    — заполните.',
      '  error  У ветки нет подписи (label)              — alt требует label у каждой ветки.',
      '  warn   Дорожек больше 6                         — объедините участников или разделите схему.',
      '  warn   Строк больше 40                          — делите по этапам на две схемы.',
      '  warn   Рамки вложены глубже 3                   — упростите.',
      '  warn   Подпись длиннее 90 знаков                — сократите, подробности в примечание n.',
      '  warn   Ответ без вызова                         — перед back должен быть say в обратную сторону.',
      '  warn   Больше 40% стрелок перелетают дорожку    — переставьте дорожки: собеседники рядом.',
      '  warn   Дорожка не участвует                     — уберите.',
      '  warn   Этап внутри рамки                        — вынесите этап наружу.',
      '  warn   В рамке «если» меньше двух веток         — используйте opt.',
      '  warn   Вопрос с отрицанием, а ветка — «да»/«нет» — пишите с пояснением.',
      '  warn   Ветка stop без шагов                     — покажите, что произошло до отказа.',
    ].join('\n'),

    scope: () => [
      'ЧЕГО НЕТ (и чем заменить)',
      '- Параллельные ветки (par): шаги всегда идут по одному. Покажите последовательно, в подписи — «параллельно».',
      '- Создание и уничтожение участников, блоки активации (полоски на линиях жизни): есть только act-блоки.',
      '- Сообщение самому себе со стрелкой-петлёй: используйте act.',
      '- Потерянные и найденные сообщения, асинхронные стрелки с другим наконечником: все сообщения одинаковы; сообщение без ответа — просто say без back.',
      '- Мягкое время (интервалы, таймеры): пишите в подписи или в этапе.',
      '- Сложная логика решений внутри одной дорожки: рисуйте блок-схемой ДРАКОН.',
      '- Автоматическая перестановка дорожек: порядок задаёте вы, lint только предупреждает.',
    ].join('\n'),

    page: () => [
      'ШАБЛОН СТРАНИЦЫ',
      '    <link rel="stylesheet" href="lanes.css">',
      '    <script src="lanes.js" charset="utf-8"></script>',
      '    <div id="out"></div>',
      '    <script>',
      '      const L = Lanes;',
      '      const scheme = L.sequence(/* … */);',
      "      Lanes.figure(document.getElementById('out'), scheme);",
      '    </script>',
      'Тёмная тема — по prefers-color-scheme и по data-theme="dark" на <html>. Цвета — токены --ln-* в lanes.css, любой можно переопределить.',
      'Артефакт claude.ai: публиковать страницу с files { "lanes.js": …, "lanes.css": … }.',
    ].join('\n'),

    node: () => [
      'РАБОТА БЕЗ БРАУЗЕРА (node)',
      '    const L = require("./lanes.js");',
      '    const s = L.sequence(…);',
      '    console.log(L.lint(s));              // замечания',
      '    require("fs").writeFileSync("s.svg", L.svg(s));   // SVG; стили из lanes.css встроить самому',
      'Ширина текста в node приближённая; в браузере точная (canvas).',
    ].join('\n'),

    example: () => [
      'ПОЛНЫЙ ПРИМЕР — запись копии (lint чистый)',
      '',
      "    const L = Lanes;",
      "    const s = L.sequence('Запись копии', {",
      "      lanes: [",
      "        L.lane('hum', 'Человек', 'human'),",
      "        L.lane('app', 'Окно Toolbelt'),",
      "        L.lane('addin', 'Надстройка', 'app', 'в процессе Inventor'),",
      "        L.lane('disk', 'Диск', 'store', 'шара проекта'),",
      '      ],',
      '      steps: [',
      "        L.phase('Подтверждение'),",
      "        L.act('hum', 'Проверить план и нажать «Записать»', 'human'),",
      "        L.say('hum', 'app', 'Записать'),",
      "        L.say('app', 'disk', 'Перечитать папки и файлы источника', null, 1),",
      "        L.alt('Всё как в плане?', [",
      "          { label: 'да, как в плане', steps: [L.say('app', 'addin', 'Скопировать файлы по плану')] },",
      "          { label: 'нет, занято или менялось', steps: [L.back('app', 'hum', 'Копирование не начато', 'stop')], stop: true },",
      '        ]),',
      "        L.phase('Запись'),",
      "        L.loop('для каждого файла', [L.say('addin', 'disk', 'Сохранить копию')]),",
      "        L.back('addin', 'app', 'Исход каждого файла'),",
      '      ],',
      "      notes: ['Папки и файлы источника перечитываются заново: план мог устареть, пока человек думал.'],",
      '    });',
    ].join('\n'),
  };

  function apiText(name) {
    const a = API[name];
    const out = [a.sig, `  ${a.does}`];
    if (a.args && a.args.length) out.push('  Аргументы:', ...a.args.map(([k, v]) => `    ${k} — ${v}`));
    if (a.returns) out.push(`  Возвращает: ${a.returns}`);
    if (a.example) out.push('  Пример:', ...a.example.split('\n').map((l) => '      ' + l));
    if (a.notes && a.notes.length) out.push('  Важно:', ...a.notes.map((x) => '    - ' + x));
    return out.join('\n');
  }

  /** Справка строкой: help() — обзор, help('say') — функция, help('rules' | 'recipes' | 'lint' | 'scope' | 'page' | 'node' | 'example' | 'all'). */
  function help(topic) {
    const key = String(topic || 'overview').trim().replace(/^Lanes\./, '').replace(/\s*\(.*$/, '');
    if (key === 'all')
      return [GUIDE.overview(), GUIDE.rules(), GUIDE.recipes(), 'ФУНКЦИИ ПОДРОБНО', ...Object.keys(API).map(apiText),
        GUIDE.lint(), GUIDE.scope(), GUIDE.page(), GUIDE.node(), GUIDE.example()].join('\n\n');
    if (key === 'lint') return apiText('lint') + '\n\n' + GUIDE.lint();
    if (API[key]) return apiText(key);
    if (GUIDE[key]) return GUIDE[key]();
    return `Нет раздела «${topic}». Есть: ${Object.keys(API).join(', ')}; ${Object.keys(GUIDE).join(', ')}, all.`;
  }

  const Lanes = { version: VERSION, lane, say, back, act, phase, loop, opt, alt, sequence, svg, figure, legend, lint, help, api: API, defaults: DEFAULTS };
  global.Lanes = Lanes;
  if (typeof module !== 'undefined' && module.exports) module.exports = Lanes;
})(typeof window !== 'undefined' ? window : globalThis);
