/* Drakon — раскладка и отрисовка блок-схем ДРАКОН в SVG. Без зависимостей, обычный скрипт (работает и с file://):
   задаёт глобальный `Drakon`. Вид — drakon.css (токены --dk-*), справочник с примерами — index.html рядом.

   Схема — данные: примитив (`Drakon.primitive`) или силуэт (`Drakon.silhouette`) из икон-конструкторов ниже.
   Раскладка следует правилам ДРАКОН: главный путь — вертикаль слева («шампур»), «да» уходит вниз, «нет» — вправо,
   чем правее — тем реже и хуже; пересечений линий нет; ветки силуэта стоят слева направо и кончаются адресом.

   Отступление, принятое у нас: у вопроса с отрицанием («Сбоев нет?») обе ветки подписываются с пояснением —
   «да, сбоев нет» / «нет, есть сбой». `Drakon.lint` напоминает об этом.

   СПРАВКА — В САМОМ API, движок читать не нужно (людям и нейросетям):
     Drakon.help()            — обзор: модель схемы, быстрый старт, все функции, список разделов;
     Drakon.help('q')         — одна функция: аргументы, что вернёт, пример, подводные камни;
     Drakon.help('rules' | 'recipes' | 'lint' | 'scope' | 'page' | 'node' | 'example' | 'all');
     Drakon.api               — то же структурно: { имя: { sig, does, args, returns, example, notes } }.
   Без браузера: node -e "console.log(require('./drakon.js').help('all'))".
   Тексты справки — раздел «справка» в конце файла. */
(function (global) {
  'use strict';

  // ─── иконы ────────────────────────────────────────────────────────────────
  // Последние аргументы икон — вид и номер примечания: строкой и числом (`act('…', 'new', 2)`) или объектом
  // (`act('…', { k: 'new', n: 2, link: 'folder' })`). Вид k — любое слово: даёт класс `dk-<k>` (в drakon.css —
  // new, ask, stop, human). n — кружок с номером, текст примечания — в `notes` схемы. link — ссылка с иконы (#якорь).
  function opts(k, n) {
    if (k && typeof k === 'object') return k;
    return { k: k || null, n: n || null };
  }

  /** Действие. */
  const act = (text, k, n) => Object.assign({ t: 'act', text }, opts(k, n));
  /** Вставка — вызов другой схемы; link — куда ведёт щелчок. */
  const ins = (text, link, k, n) => Object.assign({ t: 'ins', text, link }, opts(k, n));
  /** Полка: сверху кто или что (исполнитель, документ), снизу действие. */
  const shelf = (who, text, k, n) => Object.assign({ t: 'shelf', who, text }, opts(k, n));
  /**
   * Вопрос. o.yes — что идёт вниз до слияния (может быть пусто), o.no — путь «нет» вправо. Если o.no кончается адресом
   * (`go`), путь «нет» — своя колонка до адреса (силуэт) или до конца схемы (`go('@end')`, примитив); иначе он
   * сливается обратно под вопросом. o.down / o.right — подписи выходов (по умолчанию «да» / «нет»); o.k, o.n — вид, примечание.
   */
  const q = (text, o) => Object.assign({ t: 'q', text, yes: [], no: [] }, o || {});
  /** Выбор: cases — [{ label, seq }] или [[label, seq]]; первый вариант стоит на шампуре, остальные правее. */
  const choice = (text, cases, k, n) =>
    Object.assign({ t: 'choice', text, cases: cases.map((c) => (Array.isArray(c) ? { label: c[0], seq: c[1] } : c)) }, opts(k, n));
  /** Цикл «для каждого»: тело между началом и концом цикла. */
  const loop = (text, body, k, n) => Object.assign({ t: 'loop', text, body }, opts(k, n));
  /** Адрес: имя ветки силуэта, куда идти дальше; '@end' — к концу примитива. Только последним в пути. */
  const go = (to) => ({ t: 'goto', to });
  /** Конец: последняя икона примитива или последней ветки силуэта. */
  const end = (text) => ({ t: 'end', text: text || 'Конец' });

  /** Примитив: заголовок, один шампур, конец. items — иконы, последней — `end`. */
  const primitive = (title, items, more) => Object.assign({ kind: 'primitive', title, items, notes: [] }, more || {});
  /** Силуэт: branches — [{ name, items }]; каждая ветка кончается адресом, последняя — `end`. */
  const silhouette = (title, branches, more) => Object.assign({ kind: 'silhouette', title, branches, notes: [] }, more || {});

  // ─── размеры и текст ──────────────────────────────────────────────────────
  const DEFAULTS = {
    column: 236, // ширина колонки
    icon: 192, // ширина иконы
    gotoColumn: 128, // колонка, где только адрес
    address: 112, // ширина иконы адреса
    gap: 22, // промежуток по вертикали
    line: 15, // высота строки текста
    pad: 9, // поле текста в иконе сверху и снизу
    font: '12.5px "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
  };

  // Ширина строки: канвой, где она есть; без неё (node, тесты) — приближённо.
  let meter = null;
  function measurer(font) {
    if (typeof document === 'undefined') return (s) => s.length * 6.6;
    if (!meter) meter = document.createElement('canvas').getContext('2d');
    return (s) => { meter.font = font; return meter.measureText(s).width; };
  }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const pts = (a) => a.map((p) => p.join(',')).join(' ');

  // ─── раскладка ────────────────────────────────────────────────────────────
  function engine(cfg) {
    const CW = cfg.column, BW = cfg.icon, GW = cfg.gotoColumn, AW = cfg.address, GAP = cfg.gap, LH = cfg.line, PAD = cfg.pad;
    const width = measurer(cfg.font);

    function wrap(text, w) {
      const lines = [];
      for (const para of String(text).split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
          const probe = line ? line + ' ' + word : word;
          if (!line || width(probe) <= w) line = probe;
          else { lines.push(line); line = word; }
        }
        lines.push(line);
      }
      return lines;
    }

    const iconH = (text, min = 34, w = BW - 28) => Math.max(min, wrap(text, w).length * LH + PAD * 2);

    function textBlock(text, cx, top, h, w = BW - 28, cls = '') {
      const lines = wrap(text, w);
      const y0 = top + h / 2 - (lines.length * LH) / 2 + LH - 3.5;
      return `<text text-anchor="middle" class="dk-t ${cls}">` + lines.map((l, i) => `<tspan x="${cx}" y="${y0 + i * LH}">${esc(l)}</tspan>`).join('') + '</text>';
    }

    const vline = (x, y1, y2) => (y2 > y1 ? `<line class="dk-ln" x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>` : '');
    const hline = (y, x1, x2) => `<line class="dk-ln" x1="${Math.min(x1, x2)}" y1="${y}" x2="${Math.max(x1, x2)}" y2="${y}"/>`;
    const label = (x, y, s) => `<text class="dk-lbl" x="${x}" y="${y}">${esc(s)}</text>`;
    const badge = (n, x, y) => (n ? `<circle class="dk-badge" cx="${x}" cy="${y}" r="8"/><text class="dk-badge-t" x="${x}" y="${y + 3.5}" text-anchor="middle">${esc(n)}</text>` : '');

    function shape(kind, x, y, w, h, k) {
      const c = `dk-ic${k ? ' dk-' + k : ''}`;
      switch (kind) {
        case 'act': return `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
        case 'ins': return `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"/>` +
          `<line class="dk-in" x1="${x + 8}" y1="${y}" x2="${x + 8}" y2="${y + h}"/><line class="dk-in" x1="${x + w - 8}" y1="${y}" x2="${x + w - 8}" y2="${y + h}"/>`;
        case 'q': return `<polygon class="${c}" points="${pts([[x + 12, y], [x + w - 12, y], [x + w, y + h / 2], [x + w - 12, y + h], [x + 12, y + h], [x, y + h / 2]])}"/>`;
        case 'choice': return `<polygon class="${c}" points="${pts([[x, y], [x + w, y], [x + w, y + h - 8], [x + w / 2, y + h], [x, y + h - 8]])}"/>`;
        case 'case': return `<polygon class="${c}" points="${pts([[x, y], [x + w, y], [x + w, y + h], [x + 10, y + h], [x, y + h - 10]])}"/>`;
        case 'loop': return `<polygon class="${c}" points="${pts([[x + 10, y], [x + w - 10, y], [x + w, y + 10], [x + w, y + h], [x, y + h], [x, y + 10]])}"/>`;
        case 'loopEnd': return `<polygon class="${c}" points="${pts([[x, y], [x + w, y], [x + w, y + h - 10], [x + w - 10, y + h], [x + 10, y + h], [x, y + h - 10]])}"/>`;
        case 'pill': return `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>`;
        case 'branch': return `<polygon class="dk-ic dk-branch" points="${pts([[x, y], [x + w, y], [x + w, y + h - 9], [x + w / 2, y + h], [x, y + h - 9]])}"/>`;
        case 'addr': return `<polygon class="dk-ic dk-addr" points="${pts([[x, y + 9], [x + w / 2, y], [x + w, y + 9], [x + w, y + h], [x, y + h]])}"/>`;
      }
      return '';
    }

    const linked = (it, s) => (it.link ? `<a href="#${esc(it.link)}" aria-label="${esc(it.text)}">${s}</a>` : s);

    // Блок: w — ширина (колонка 0 — CW), h — высота главного пути, bottom — низ всего содержимого;
    // draw(out, x, y[, colX]) рисует и возвращает висящие концы { x, y, to } — их доводит до адреса или до конца владелец.
    function measure(it) {
      if (it.t === 'act' || it.t === 'ins') {
        const h = iconH(it.text);
        return { w: CW, h: h + GAP, bottom: h + GAP, draw(out, x, y) {
          const ix = x + (CW - BW) / 2;
          out.icons.push(linked(it, shape(it.t, ix, y, BW, h, it.k) + textBlock(it.text, x + CW / 2, y, h) + badge(it.n, ix + BW - 2, y + 2)));
          return [];
        } };
      }
      if (it.t === 'shelf') {
        const wh = iconH(it.who, 24, BW - 20) - 6, th = iconH(it.text);
        const h = wh + th;
        return { w: CW, h: h + GAP, bottom: h + GAP, draw(out, x, y) {
          const ix = x + (CW - BW) / 2;
          out.icons.push(linked(it, shape('act', ix, y, BW, h, it.k) + hline(y + wh, ix, ix + BW).replace('dk-ln', 'dk-in') +
            textBlock(it.who, x + CW / 2, y, wh, BW - 20, 'dk-who') + textBlock(it.text, x + CW / 2, y + wh, th) + badge(it.n, ix + BW - 2, y + 2)));
          return [];
        } };
      }
      if (it.t === 'q') {
        const qh = iconH(it.text, 38, BW - 40);
        const no = it.no || [];
        const terminal = no.length > 0 && no[no.length - 1].t === 'goto';
        const icon = (out, x, y) => {
          const ix = x + (CW - BW) / 2;
          out.icons.push(shape('q', ix, y, BW, qh, it.k) + textBlock(it.text, x + CW / 2, y, qh, BW - 40) + badge(it.n, ix + BW - 10, y + 2));
          out.icons.push(label(x + CW / 2 + 6, y + qh + 13, it.down || 'да'));
          out.icons.push(label(ix + BW + 6, y + qh / 2 - 6, it.right || 'нет'));
        };
        if (terminal) {
          const nb = layoutSeq(no);
          const bare = nb.items === 0;
          return { w: CW, h: qh + GAP, bottom: qh + GAP, terminal: true, tw: bare ? GW : nb.w, tbottom: qh + GAP + (bare ? 0 : nb.h),
            draw(out, x, y, colX) {
              icon(out, x, y);
              const cx = bare ? colX + GW / 2 : colX + CW / 2;
              out.lines.push(hline(y + qh / 2, x + (CW + BW) / 2, cx));
              if (bare) return [{ x: cx, y: y + qh / 2, to: nb.tail }];
              out.lines.push(vline(cx, y + qh / 2, y + qh + GAP));
              return nb.draw(out, colX, y + qh + GAP);
            } };
        }
        const yes = layoutSeq(it.yes || []);
        const nb = layoutSeq(no);
        const span = Math.max(yes.h, nb.h, 10);
        const h = qh + GAP + span + 12;
        return { w: yes.w + nb.w, h, bottom: h, draw(out, x, y) {
          icon(out, x, y);
          const cx = x + yes.w + CW / 2;
          const join = y + qh + GAP + span;
          out.lines.push(hline(y + qh / 2, x + (CW + BW) / 2, cx));
          out.lines.push(vline(cx, y + qh / 2, join));
          out.lines.push(hline(join, cx, x + CW / 2));
          yes.draw(out, x, y + qh + GAP);
          nb.draw(out, x + yes.w, y + qh + GAP);
          return [];
        } };
      }
      if (it.t === 'choice') {
        const ch = iconH(it.text, 36);
        const cases = it.cases.map((c) => ({ c, s: layoutSeq(c.seq), vh: iconH(c.label, 28) }));
        const vh = Math.max(...cases.map((c) => c.vh));
        const sh = Math.max(...cases.map((c) => c.s.h));
        const w = cases.reduce((a, c) => a + c.s.w, 0);
        const lineY = ch + 16, seqTop = lineY + 14 + vh + GAP, merge = seqTop + sh;
        const h = merge + 12;
        return { w, h, bottom: h, draw(out, x, y) {
          const ix = x + (CW - BW) / 2;
          out.icons.push(shape('choice', ix, y, BW, ch, it.k) + textBlock(it.text, x + CW / 2, y - 3, ch) + badge(it.n, ix + BW - 2, y + 2));
          let cx = x;
          const centers = [];
          for (const c of cases) {
            const mid = cx + CW / 2;
            centers.push(mid);
            out.lines.push(vline(mid, y + lineY, y + merge));
            out.icons.push(shape('case', cx + (CW - BW) / 2, y + lineY + 14, BW, c.vh, c.c.k) + textBlock(c.c.label, mid, y + lineY + 14, c.vh));
            c.s.draw(out, cx, y + seqTop);
            cx += c.s.w;
          }
          out.lines.push(hline(y + lineY, centers[0], centers[centers.length - 1]));
          out.lines.push(hline(y + merge, centers[0], centers[centers.length - 1]));
          return [];
        } };
      }
      if (it.t === 'loop') {
        const lh = iconH(it.text, 36);
        const body = layoutSeq(it.body);
        const eh = 26;
        const h = lh + GAP + body.h + eh + GAP;
        return { w: body.w, h, bottom: h, draw(out, x, y) {
          const ix = x + (CW - BW) / 2;
          out.icons.push(shape('loop', ix, y, BW, lh, it.k) + textBlock(it.text, x + CW / 2, y, lh) + badge(it.n, ix + BW - 2, y + 2));
          body.draw(out, x, y + lh + GAP);
          const ey = y + lh + GAP + body.h;
          out.icons.push(shape('loopEnd', ix, ey, BW, eh) + textBlock('конец цикла', x + CW / 2, ey, eh, BW - 28, 'dk-lbl'));
          return [];
        } };
      }
      throw new Error(`Drakon: неизвестная икона «${it.t}»`);
    }

    // Колонки путей «нет» с адресом стоят правее всего, что ниже их вопроса, а более ранние — правее поздних:
    // горизонталь каждого вопроса тогда не пересекает ни одной вертикали.
    function layoutSeq(source) {
      const items = source.slice();
      const tail = items.length && items[items.length - 1].t === 'goto' ? items.pop().to : null;
      const ms = items.map(measure);
      const n = ms.length;
      const rest = new Array(n + 1).fill(0);
      const off = [];
      for (let i = n - 1; i >= 0; i--) {
        const m = ms[i];
        if (m.terminal) { off[i] = CW + rest[i + 1]; rest[i] = rest[i + 1] + m.tw; }
        else rest[i] = Math.max(rest[i + 1], m.w - CW);
      }
      const ys = [];
      let h = 0, bottom = 0;
      for (let i = 0; i < n; i++) {
        ys[i] = h;
        bottom = Math.max(bottom, h + (ms[i].terminal ? ms[i].tbottom : ms[i].bottom));
        h += ms[i].h;
      }
      bottom = Math.max(bottom, h);
      return { items: n, tail, w: CW + rest[0], h, bottom, draw(out, x, y) {
        out.lines.push(vline(x + CW / 2, y, y + h));
        const pend = [];
        for (let i = 0; i < n; i++) pend.push(...ms[i].draw(out, x, y + ys[i], x + off[i]));
        if (tail) pend.push({ x: x + CW / 2, y: y + h, to: tail });
        return pend;
      } };
    }

    function svgOf(out, w, h, title) {
      return `<svg class="dk" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">` +
        out.lines.join('') + out.icons.join('') + '</svg>';
    }

    function silhouetteSvg(d) {
      const out = { lines: [], icons: [] };
      const left = 34, gapB = 14, hh = 38, y0 = 14, ah = 34;
      // Веточный цикл: адрес, ведущий в эту же ветку или левее, и ветка, куда он ведёт, помечаются знаком повтора.
      const at = new Map(d.branches.map((b, i) => [b.name, i]));
      const repeats = new Set();
      d.branches.forEach((b, i) => collectGotos(b.items).forEach((to) => { if (at.has(to) && at.get(to) <= i) repeats.add(to); }));
      const mark = (x, y) => `<text class="dk-loopmark" x="${x}" y="${y}" text-anchor="middle">↻</text>`;
      const bs = d.branches.map((b) => {
        const items = b.items.slice();
        const fin = items.length && items[items.length - 1].t === 'end' ? items.pop() : null;
        return { b, fin, s: layoutSeq(items), nh: iconH(b.name, 34, BW - 40) };
      });
      const busY = y0 + hh + 18, nameTop = busY + 16;
      const nh = Math.max(...bs.map((b) => b.nh));
      const seqTop = nameTop + nh + GAP;
      const addrTop = seqTop + Math.max(...bs.map((b) => b.s.bottom)) + 18;
      const bottomBus = addrTop + ah + 16;
      let x = left + 12;
      const xs = bs.map((b) => { const at = x; x += b.s.w + gapB; return at; });

      const c0 = xs[0] + CW / 2;
      out.icons.push(shape('pill', c0 - BW / 2, y0, BW, hh) + textBlock(d.title, c0, y0, hh, BW - 20, 'dk-b'));
      out.lines.push(vline(c0, y0 + hh, busY));
      out.lines.push(hline(busY, left, xs[xs.length - 1] + CW / 2));
      out.lines.push(vline(left, busY, bottomBus));
      out.lines.push(`<polygon class="dk-arrow" points="${pts([[left + 14, busY - 5], [left + 24, busY], [left + 14, busY + 5]])}"/>`);
      let farthest = left;

      bs.forEach((b, i) => {
        const bx = xs[i], cx = bx + CW / 2;
        out.lines.push(vline(cx, busY, nameTop));
        out.icons.push(`<g id="${esc(d.id ? d.id + '-' : '')}${esc(b.b.name)}">` + shape('branch', cx - BW / 2, nameTop, BW, nh) + textBlock(b.b.name, cx, nameTop - 3, nh, BW - 40, 'dk-b') +
          (repeats.has(b.b.name) ? mark(cx + BW / 2 - 13, nameTop + 15) : '') + '</g>');
        out.lines.push(vline(cx, nameTop + nh, seqTop));
        const pend = b.s.draw(out, bx, seqTop);
        if (b.fin) {
          out.lines.push(vline(cx, seqTop + b.s.h, addrTop));
          out.icons.push(shape('pill', cx - BW / 2 + 30, addrTop, BW - 60, ah) + textBlock(b.fin.text, cx, addrTop, ah, BW - 80, 'dk-b'));
        }
        for (const p of pend) {
          out.lines.push(vline(p.x, p.y, addrTop));
          out.icons.push(shape('addr', p.x - AW / 2, addrTop, AW, ah) + textBlock(p.to, p.x, addrTop + 4, ah - 4, AW - 12, 'dk-b') +
            (at.has(p.to) && at.get(p.to) <= i ? mark(p.x + AW / 2 - 10, addrTop + 20) : ''));
          out.lines.push(vline(p.x, addrTop + ah, bottomBus));
          farthest = Math.max(farthest, p.x);
        }
      });
      out.lines.push(hline(bottomBus, left, farthest));
      return svgOf(out, x + 10, bottomBus + 22, d.title);
    }

    function primitiveSvg(d) {
      const out = { lines: [], icons: [] };
      const items = d.items.slice();
      const fin = items.length && items[items.length - 1].t === 'end' ? items.pop() : end();
      const s = layoutSeq(items);
      const x = 16, y0 = 14, hh = 38;
      const cx = x + CW / 2;
      const top = y0 + hh + GAP;
      out.icons.push(shape('pill', cx - BW / 2, y0, BW, hh) + textBlock(d.title, cx, y0, hh, BW - 20, 'dk-b'));
      out.lines.push(vline(cx, y0 + hh, top));
      const pend = s.draw(out, x, top);
      const join = top + s.bottom + 10;
      const endTop = join + 18;
      out.lines.push(vline(cx, top + s.h, endTop));
      for (const p of pend) {
        out.lines.push(vline(p.x, p.y, join));
        out.lines.push(hline(join, p.x, cx));
      }
      out.icons.push(shape('pill', cx - BW / 2, endTop, BW, 36) + textBlock(fin.text, cx, endTop, 36, BW - 20, 'dk-b'));
      return svgOf(out, x + s.w + 16, endTop + 52, d.title);
    }

    return { primitiveSvg, silhouetteSvg };
  }

  // ─── проверка схемы ───────────────────────────────────────────────────────
  const NEGATION = /(^|[\s,(«])(не|нет|без|ни)([\s,?»)]|$)/i;
  const MAX_BRANCHES = 16, MAX_CASES = 16, MAX_PRIMITIVE = 15; // пределы языка (Паронджанов): ветки, варианты выбора, икон в простом примитиве

  /** Куда ведут адреса в путях (вложенно), именами. */
  function collectGotos(items, found) {
    found = found || [];
    for (const it of items) {
      if (it.t === 'goto') found.push(it.to);
      else if (it.t === 'q') { collectGotos(it.yes || [], found); collectGotos(it.no || [], found); }
      else if (it.t === 'choice') it.cases.forEach((c) => collectGotos(c.seq, found));
      else if (it.t === 'loop') collectGotos(it.body, found);
    }
    return found;
  }

  /** Сколько икон в путях (адреса и концы не считаются). */
  function countIcons(items) {
    let n = 0;
    for (const it of items) {
      if (it.t === 'goto' || it.t === 'end') continue;
      n += 1;
      if (it.t === 'q') n += countIcons(it.yes || []) + countIcons(it.no || []);
      else if (it.t === 'choice') n += it.cases.reduce((a, c) => a + 1 + countIcons(c.seq), 0);
      else if (it.t === 'loop') n += countIcons(it.body) + 1;
    }
    return n;
  }

  /** Замечания к схеме: [{ level: 'error' | 'warn', where, message }]. Ошибки ломают раскладку, предупреждения — чтение. */
  function lint(d) {
    const found = [];
    const say = (level, where, message) => found.push({ level, where, message });
    const branches = d.kind === 'silhouette' ? new Set(d.branches.map((b) => b.name)) : new Set();

    function walk(items, where, top) {
      items.forEach((it, i) => {
        const at = `${where} › ${it.text || it.to || it.t}`;
        const last = i === items.length - 1;
        if (it.t === 'goto') {
          if (!last) say('error', at, 'Адрес стоит не последним в пути.');
          if (!top) say('error', at, 'Адрес внутри цикла, выбора или сливающегося вопроса: раскладка так не умеет.');
          if (d.kind === 'silhouette' && !branches.has(it.to)) say('error', at, `Нет ветки «${it.to}».`);
          if (d.kind === 'primitive' && it.to !== '@end') say('error', at, "В примитиве адрес — только '@end'.");
        }
        if (it.t === 'end' && !(top && last)) say('error', at, 'Конец — только последней иконой схемы или ветки.');
        if (it.t === 'q') {
          if (NEGATION.test(it.text) && (!it.down || !it.right))
            say('warn', at, 'Вопрос с отрицанием: подпишите выходы с пояснением («да, …» / «нет, …»).');
          const no = it.no || [];
          const terminal = no.length && no[no.length - 1].t === 'goto';
          if (terminal && (it.yes || []).length) say('error', at, 'У вопроса с адресом на «нет» путь «да» — продолжение шампура, yes не нужен.');
          walk(it.yes || [], at, false);
          walk(no, at, top && terminal);
        }
        if (it.t === 'choice') {
          if (it.cases.length < 2) say('warn', at, 'Выбор с одним вариантом — это действие.');
          if (it.cases.length > MAX_CASES) say('warn', at, `В выборе не больше ${MAX_CASES} вариантов (язык ДРАКОН): их ${it.cases.length}.`);
          it.cases.forEach((c) => walk(c.seq, `${at} › ${c.label}`, false));
        }
        if (it.t === 'loop') walk(it.body, at, false);
      });
    }

    if (/^\s*(начало|старт)\s*\.?\s*$/i.test(d.title || ''))
      say('warn', d.title, 'В заголовке не пишут «Начало»: назовите алгоритм понятно и точно.');

    if (d.kind === 'primitive') {
      const n = countIcons(d.items);
      if (n > MAX_PRIMITIVE) say('warn', d.title, `Примитив — для простых алгоритмов (до ${MAX_PRIMITIVE} икон), здесь ${n}: сложное рисуют силуэтом, по частям.`);
      walk(d.items, d.title, true);
    } else {
      const index = new Map();
      const reached = new Set();
      d.branches.forEach((b, i) => {
        if (index.has(b.name)) say('error', b.name, 'Имя ветки повторяется: в схеме они уникальны.');
        index.set(b.name, i);
        collectGotos(b.items).forEach((to) => reached.add(to));
      });
      if (d.branches.length < 2) say('warn', d.title, 'Силуэт из одной ветки — это примитив.');
      if (d.branches.length > MAX_BRANCHES) say('warn', d.title, `Веток не больше ${MAX_BRANCHES} (язык ДРАКОН): их ${d.branches.length}.`);
      d.branches.forEach((b, i) => {
        const tail = b.items[b.items.length - 1];
        const last = i === d.branches.length - 1;
        if (last && (!tail || tail.t !== 'end')) say('error', b.name, 'Последняя ветка кончается иконой «Конец».');
        if (!last && (!tail || tail.t !== 'goto')) say('error', b.name, 'Ветка кончается адресом следующей.');
        if (i > 0 && !reached.has(b.name)) say('warn', b.name, 'Ни один адрес не ведёт на эту ветку: до неё не дойти.');
        walk(b.items, b.name, true);
      });
    }
    return found;
  }

  // ─── вывод ────────────────────────────────────────────────────────────────
  /** SVG схемы строкой. options — размеры (DEFAULTS). */
  function svg(d, options) {
    const e = engine(Object.assign({}, DEFAULTS, options || {}));
    for (const f of lint(d)) (f.level === 'error' ? console.error : console.warn)(`Drakon «${d.title}»: ${f.where}: ${f.message}`);
    return d.kind === 'silhouette' ? e.silhouetteSvg(d) : e.primitiveSvg(d);
  }

  /**
   * Схема в контейнер: поле с прокруткой, кнопка «Вписать по ширине» и примечания списком.
   * options: те же размеры и { fit: false } — без кнопки, { notes: false } — без примечаний.
   */
  function figure(container, d, options) {
    const o = Object.assign({ fit: true, notes: true }, options || {});
    let body;
    try { body = svg(d, o); } catch (e) { body = `<p class="dk-fail">Схема не нарисовалась: ${esc(e.message)}</p>`; }
    const notes = o.notes && d.notes && d.notes.length ? `<ol class="dk-notes">${d.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>` : '';
    container.innerHTML = (o.fit ? '<div class="dk-bar"><button type="button" class="dk-fit">Вписать по ширине</button></div>' : '') +
      `<div class="dk-canvas">${body}</div>` + notes;
    const btn = container.querySelector('.dk-fit');
    if (btn) btn.addEventListener('click', () => {
      const on = container.querySelector('.dk-canvas').classList.toggle('dk-fitted');
      btn.textContent = on ? 'В натуральную величину' : 'Вписать по ширине';
    });
    return container;
  }

  /** Обозначения: иконы и, если даны, виды — { new: 'решение — сделать', … }. HTML строкой. */
  function legend(kinds) {
    const s = (w, h, inner) => `<svg class="dk" width="${w}" height="${h}" aria-hidden="true">${inner}</svg>`;
    const fig = (pic, text) => `<figure>${pic}${esc(text)}</figure>`;
    const icons = [
      fig(s(58, 24, '<rect class="dk-ic" x="1" y="2" width="56" height="20" rx="10"/>'), 'заголовок, конец'),
      fig(s(44, 24, '<rect class="dk-ic" x="1" y="2" width="42" height="20"/>'), 'действие'),
      fig(s(50, 24, '<polygon class="dk-ic" points="9,2 41,2 49,12 41,22 9,22 1,12"/>'), 'вопрос'),
      fig(s(50, 24, '<rect class="dk-ic" x="1" y="2" width="48" height="20"/><line class="dk-in" x1="7" y1="2" x2="7" y2="22"/><line class="dk-in" x1="43" y1="2" x2="43" y2="22"/>'), 'вставка — другая схема'),
      fig(s(50, 26, '<rect class="dk-ic" x="1" y="2" width="48" height="22"/><line class="dk-in" x1="1" y1="10" x2="49" y2="10"/>'), 'полка'),
      fig(s(50, 24, '<polygon class="dk-ic" points="1,2 49,2 49,14 25,22 1,14"/>'), 'выбор'),
      fig(s(50, 24, '<polygon class="dk-ic" points="1,2 49,2 49,22 11,22 1,12"/>'), 'вариант'),
      fig(s(50, 24, '<polygon class="dk-ic" points="7,2 43,2 49,8 49,22 1,22 1,8"/>'), 'цикл'),
      fig(s(50, 26, '<polygon class="dk-ic dk-branch" points="1,2 49,2 49,16 25,24 1,16"/>'), 'имя ветки'),
      fig(s(50, 26, '<polygon class="dk-ic dk-addr" points="1,10 25,2 49,10 49,24 1,24"/>'), 'адрес — куда дальше'),
      fig('<span class="dk-loopmark-demo" aria-hidden="true">↻</span>', 'повтор: адрес назад и ветка, куда он ведёт'),
    ];
    const marks = Object.entries(kinds || {}).map(([k, text]) => fig(`<span class="dk-swatch dk-${esc(k)}"></span>`, text));
    return `<div class="dk-legend">${icons.join('')}${marks.length ? '<span class="dk-sep" aria-hidden="true"></span>' + marks.join('') : ''}</div>`;
  }

  // ─── справка ──────────────────────────────────────────────────────────────
  // Всё, что нужно, чтобы писать схемы, не читая движок. help() собирает текст из API и GUIDE.
  const VERSION = '1.2';
  const KINDS = "вид k: 'new' — решено, сделать; 'ask' — вопрос владельцу; 'human' — делает человек; 'stop' — отказ, откат; " +
    "любое другое слово — CSS-класс dk-<слово>; null — обычный";
  const NOTE_N = 'номер примечания (1, 2, …): кружок на иконе; текст — notes[n-1] схемы';

  const API = {
    act: {
      sig: 'act(text, k?, n?)',
      does: 'Действие — прямоугольник на пути.',
      args: [['text', "строка; '\\n' — перенос строки, длинный текст переносится сам"], ['k', KINDS], ['n', NOTE_N]],
      returns: "икона { t: 'act', text, k, n }",
      example: "D.act('Перечитать machine.json')\nD.act('«Файл занят»', 'stop')\nD.act('Префикс от папки', 'new', 2)",
      notes: ["Вместо k, n можно объект: act('…', { k: 'new', n: 2, link: 'names' }) — link делает икону ссылкой на #names (так у всех икон, кроме q и go)."],
    },
    shelf: {
      sig: 'shelf(who, text, k?, n?)',
      does: 'Полка: сверху мелко — кто делает или над чем (система, роль, файл), снизу — действие.',
      args: [['who', 'исполнитель или документ'], ['text', 'действие'], ['k', KINDS], ['n', NOTE_N]],
      returns: "икона { t: 'shelf', who, text, k, n }",
      example: "D.shelf('Inventor', 'Сохранить копию')",
    },
    ins: {
      sig: 'ins(text, link, k?, n?)',
      does: 'Вставка — вызов другой схемы (прямоугольник с двойными боковинами). Щелчок ведёт на #link.',
      args: [['text', 'что делает вызываемая схема'], ['link', "id элемента без '#', или null"], ['k', KINDS], ['n', NOTE_N]],
      returns: "икона { t: 'ins', text, link, k, n }",
      example: "D.ins('Проверить имена', 'copy-Имена')",
      notes: ["У силуэта с { id: 'copy' } каждая ветка получает id 'copy-<имя ветки>' — на неё можно сослаться из вставки."],
    },
    q: {
      sig: 'q(text, { yes?, no?, down?, right?, k?, n? })',
      does: 'Вопрос (шестиугольник). «да» — вниз, «нет» — вправо. Два режима — по тому, чем кончается no.',
      args: [
        ['text', "вопрос; удачный путь идёт вниз, по шампуру: 'Файл доступен?'"],
        ['yes', 'иконы под вопросом до слияния (только у сливающегося вопроса); по умолчанию []'],
        ['no', 'иконы пути «нет»; по умолчанию [] — просто линия'],
        ['down', "подпись выхода вниз, по умолчанию 'да'"],
        ['right', "подпись выхода вправо, по умолчанию 'нет'"],
        ['k', KINDS], ['n', NOTE_N],
      ],
      returns: "икона { t: 'q', text, yes, no, down, right, k, n }",
      example:
        "// выход: no кончается адресом — своя колонка справа, шампур идёт дальше вниз\n" +
        "D.q('Файл доступен?', { no: [D.act('«Файл занят»', 'stop'), D.go('Ввод')] })\n" +
        "// слияние: yes и no сходятся под вопросом\n" +
        "D.q('Чертёж открыт?', { yes: [D.act('Взять открытый')], no: [D.act('Открыть невидимо')] })\n" +
        "// отрицание в вопросе — подписи с пояснением\n" +
        "D.q('Сбоев нет?', { down: 'да, сбоев нет', right: 'нет, есть сбой', no: [D.act('Список сбоев', 'stop')] })",
      notes: [
        "Выход: если последняя икона no — go(…), путь «нет» уходит в свою колонку до адреса (силуэт) или до конца ('@end', примитив). Тогда yes должен быть пуст: «да» — это иконы, идущие после вопроса.",
        'Слияние: иначе yes рисуется под вопросом, no — правее, и оба сходятся. Внутри такого вопроса go(…) нельзя.',
        "Внутри no-выхода можно ставить ещё вопросы-выходы (вложенно), но не циклы/выборы с адресами.",
        "Отрицание (не, нет, без, ни) в тексте без down и right — предупреждение lint. Пиши: down: 'да, не совпадают', right: 'нет, совпадают'.",
        "Подписи можно менять местами: в ДРАКОН неважно, какой выход помечен «да»; важно, чтобы вниз (на шампур) шёл удачный путь: down: 'нет', right: 'да'.",
        "Не пиши логическую формулу в вопросе («А и Б или В»): каждый операнд — свой вопрос. И — вопросы друг под другом на шампуре, ИЛИ — лесенкой.",
      ],
    },
    choice: {
      sig: 'choice(text, cases, k?, n?)',
      does: 'Выбор из нескольких вариантов; варианты стоят слева направо и сливаются под выбором.',
      args: [['text', "о чём выбор: 'Формат листа'"], ['cases', "[[подпись, иконы], …] или [{ label, seq, k? }, …]; первый — на шампуре"], ['k', KINDS], ['n', NOTE_N]],
      returns: "икона { t: 'choice', text, cases: [{ label, seq }] }",
      example: "D.choice('Формат листа', [\n  ['A4, A3', [D.act('Печать как есть')]],\n  ['A2 и больше', [D.act('Вписать в A3', 'new')]],\n])",
      notes: ['Внутри вариантов go(…) нельзя. Вариант может быть пустым: [подпись, []].', 'Каждый вариант добавляет колонку ширины — не больше 3–4.'],
    },
    loop: {
      sig: 'loop(text, body, k?, n?)',
      does: 'Цикл «для каждого»: иконы body между началом и концом цикла.',
      args: [['text', "'Для каждого листа'"], ['body', 'иконы тела'], ['k', KINDS], ['n', NOTE_N]],
      returns: "икона { t: 'loop', text, body }",
      example: "D.loop('Для каждого файла', [D.act('Скопировать'), D.q('Скопирован?', { no: [D.act('Записать сбой')] })])",
      notes: ['В теле go(…) нельзя: ранний выход из цикла не рисуется. Вынеси решение после цикла: q(\'Сбоев нет?\', …).'],
    },
    go: {
      sig: 'go(to)',
      does: 'Адрес — куда идти дальше. Только последней иконой своего пути.',
      args: [['to', "имя ветки силуэта (точно как в name) или '@end' в примитиве"]],
      returns: "{ t: 'goto', to }",
      example: "D.go('Запись')\nD.go('@end')",
      notes: [
        'Где можно: в конце ветки силуэта (обязательно, кроме последней) и в конце no у вопроса-выхода.',
        'Где нельзя: внутри loop, choice, yes/no сливающегося вопроса; не последним.',
        'Возврат в более раннюю ветку — тоже go: так рисуется повтор на уровне силуэта.',
      ],
    },
    end: {
      sig: 'end(text?)',
      does: "Конец (овал). Последняя икона примитива или последней ветки силуэта. По умолчанию текст 'Конец'.",
      args: [['text', "'Готово', 'Копия сделана'"]],
      returns: "{ t: 'end', text }",
      example: "D.end('Готово')",
      notes: ['В примитиве можно не ставить — нарисуется «Конец».'],
    },
    primitive: {
      sig: 'primitive(title, items, { notes?, id? }?)',
      does: 'Схема-примитив: заголовок, один шампур, конец. Для коротких алгоритмов без переходов между частями.',
      args: [['title', 'название схемы (овал сверху)'], ['items', 'иконы шампура; последней — end()'], ['notes', 'тексты примечаний: notes[0] — кружок 1'], ['id', 'префикс id для ссылок']],
      returns: "схема { kind: 'primitive', title, items, notes }",
      example: "D.primitive('Печать', [\n  D.q('Принтер есть?', { no: [D.act('«Нет принтера»', 'stop'), D.go('@end')] }),\n  D.act('Напечатать'),\n  D.end('Готово'),\n], { notes: [] })",
      notes: ["Ранний выход — вопрос с no, кончающимся go('@end'). Другие адреса в примитиве — ошибка: нужен силуэт.",
        'Примитив — для простых алгоритмов, до 15 икон (Паронджанов: 5–15); сложное рисуют силуэтом. В заголовке не пишут «Начало» — только название алгоритма.'],
    },
    silhouette: {
      sig: 'silhouette(title, branches, { notes?, id? }?)',
      does: 'Схема-силуэт: ветки слева направо в порядке исполнения, верхняя и нижняя шины, возврат слева. Для логики из нескольких частей.',
      args: [['title', 'название схемы'], ['branches', '[{ name, items }, …]; name — уникальное имя ветки'], ['notes', 'тексты примечаний'], ['id', "префикс id веток: id 'copy' → ветка 'copy-Имена'"]],
      returns: "схема { kind: 'silhouette', title, branches, notes }",
      example: "D.silhouette('Заметка', [\n  { name: 'Ввод', items: [D.act('Набрать текст', 'human'), D.go('Запись')] },\n  { name: 'Запись', items: [\n    D.q('Файл доступен?', { no: [D.act('«Файл занят»', 'stop'), D.go('Ввод')] }),\n    D.act('Записать'), D.go('Итог') ] },\n  { name: 'Итог', items: [D.act('Обновить список'), D.end()] },\n], { id: 'note' })",
      notes: [
        "Каждая ветка, кроме последней, кончается go('…'); последняя — end(). Конец в схеме один: ранний выход — go на последнюю ветку.",
        'Ветки стоят слева направо в порядке времени: «чем правее — тем позже». Адрес в следующую справа ветку — норма; пропустить ветки можно только по условию (go из вопроса-выхода).',
        'Адрес в эту же ветку или левее — веточный цикл (повтор): рисуется со знаком ↻ на адресе и на ветке, куда он ведёт.',
        'Верхняя полоса (заголовок и имена веток) отвечает на три вопроса: как называется задача, из скольких частей, как называется каждая. Имена веток уникальны; не больше 16.',
        'Ширина — сумма ширин веток: 4–8 веток читаются, больше — дели на несколько схем через ins.',
      ],
    },
    svg: {
      sig: 'svg(scheme, sizes?)',
      does: 'Разложить и нарисовать: SVG строкой. Замечания lint пишет в консоль (error/warn).',
      args: [['scheme', 'primitive(…) или silhouette(…)'], ['sizes', 'переопределить Drakon.defaults: { column, icon, gotoColumn, address, gap, line, pad, font }']],
      returns: "строка '<svg class=\"dk\" …>…</svg>'; цвета — из drakon.css",
      example: "el.innerHTML = D.svg(scheme)\nD.svg(scheme, { column: 260, icon: 216 })  // шире иконы",
      notes: ["Бросает Error('Drakon: неизвестная икона …'), если в путь попало не то (undefined, массив вместо иконы)."],
    },
    figure: {
      sig: 'figure(container, scheme, options?)',
      does: 'Схема в контейнер целиком: поле с прокруткой, кнопка «Вписать по ширине», примечания нумерованным списком.',
      args: [['container', 'DOM-элемент; его содержимое заменяется'], ['scheme', 'схема'], ['options', '{ fit: false } — без кнопки, { notes: false } — без примечаний, плюс размеры как у svg']],
      returns: 'container',
      example: "D.figure(document.getElementById('fig'), scheme)",
      notes: ['Если схема не рисуется, в контейнере появится текст ошибки (класс dk-fail), а не пустота.'],
    },
    legend: {
      sig: 'legend(kinds?)',
      does: 'Обозначения: все виды икон и, если даны, цвета видов. HTML строкой.',
      args: [['kinds', "{ вид: подпись }, напр. { new: 'решено — сделать', ask: 'вопрос владельцу', human: 'делает человек', stop: 'отказ, откат' }"]],
      returns: 'строка HTML (div.dk-legend)',
      example: "document.getElementById('legend').innerHTML = D.legend({ new: 'сделать', stop: 'отказ' })",
    },
    lint: {
      sig: 'lint(scheme)',
      does: 'Проверка схемы до отрисовки. Пустой массив — схема годна.',
      args: [['scheme', 'схема']],
      returns: "[{ level: 'error' | 'warn', where: 'Ветка › икона', message }]",
      example: "const bad = D.lint(scheme).filter((f) => f.level === 'error')",
      notes: ["error — раскладка так не умеет или нарушен язык; warn — трудно читать. Все сообщения и как чинить — Drakon.help('lint')."],
    },
    help: {
      sig: 'help(topic?)',
      does: 'Эта справка строкой (в консоли — console.log(Drakon.help(…))).',
      args: [['topic', "имя функции ('q', 'Drakon.q', 'q()' — всё равно) или раздел: rules, recipes, lint, page, node, example, all"]],
      returns: 'строка',
      example: "console.log(Drakon.help())\nconsole.log(Drakon.help('recipes'))",
    },
    defaults: {
      sig: 'defaults',
      does: 'Размеры раскладки по умолчанию (px): column 236, icon 192, gotoColumn 128, address 112, gap 22, line 15, pad 9, font.',
      returns: 'объект; не менять — передавать свои размеры вторым аргументом svg/figure',
      example: "D.svg(scheme, { gap: 16 })",
    },
  };

  const GUIDE = {
    overview: () => [
      `Drakon ${VERSION} — блок-схемы ДРАКОН в SVG. drakon.js (без зависимостей, глобальный Drakon) + drakon.css (вид).`,
      '',
      'Схема — это данные. Собираешь её из икон-конструкторов, библиотека сама раскладывает по правилам ДРАКОН',
      '(шампур слева, «да» вниз, «нет» вправо, без пересечений) и рисует. Координаты и линии не задаются.',
      '',
      'МОДЕЛЬ',
      '  Путь — массив икон: act, shelf, ins, q, choice, loop; может кончаться адресом go(…).',
      "  primitive(title, items)       — один шампур; последней end(); ранний выход — go('@end').",
      "  silhouette(title, branches)   — ветки [{ name, items }] слева направо; каждая кончается go('ИмяВетки'),",
      '                                  последняя — end().',
      '',
      'БЫСТРЫЙ СТАРТ',
      '    const D = Drakon;',
      "    const s = D.primitive('Печать', [",
      "      D.act('Взять принтер станции'),",
      "      D.q('Принтер найден?', { no: [D.act('«Нет принтера»', 'stop'), D.go('@end')] }),",
      "      D.act('Напечатать'),",
      "      D.end('Готово'),",
      '    ]);',
      '    D.lint(s);                                        // [] — годна',
      "    D.figure(document.getElementById('fig'), s);      // нарисовать",
      "  Шаблон страницы — Drakon.help('page'); как выразить if/else, выходы, циклы — Drakon.help('recipes').",
      '',
      'ФУНКЦИИ',
      ...Object.values(API).map((a) => `  ${a.sig.padEnd(44)} ${a.does.split('. ')[0].replace(/\.$/, '')}.`),
      '',
      "РАЗДЕЛЫ: Drakon.help('<функция>'), 'rules', 'recipes', 'lint', 'scope', 'page', 'node', 'example', 'all'.",
      'Структурно — Drakon.api. Порядок работы: собрать → lint → починить ошибки → figure.',
    ].join('\n'),

    rules: () => [
      'ПРАВИЛА ДРАКОН, на которые опирается раскладка',
      '(источники: Паронджанов, «Visual Syntax of the DRAKON Language», 1995, и его «Эргономические правила построения ДРАКОН-схем»;',
      ' Миткин, «DRAKON: The Human Revolution in Understanding Programs», 2011)',
      '',
      'Устройство',
      '- Шампур — главная вертикаль: вход и выход ветки (или примитива) лежат на одной вертикали, иконы главного пути — на ней.',
      '- Главный маршрут — путь наибольшего успеха («счастливый путь») — идёт по шампуру. Побочные маршруты — правее,',
      '  упорядочены по критерию: «чем правее — тем хуже» (если «хуже» не про что — другой: дальше, дороже, позже…).',
      '  То же для выходов ветки: чем правее адрес, тем хуже исход. Главные выходы веток вместе образуют главный маршрут схемы.',
      '- Вопрос — шестиугольник: выходы только вниз и вправо, влево нельзя. Какой выход «да» — неважно (можно поменять',
      '  подписи, чтобы удачный путь шёл вниз). Подписи — «да» и «нет», а не «истина» и «ложь».',
      '- Выбор: икона вопроса и 2+ икон вариантов сразу под ней, между ними ничего нет. Лучший вариант — на шампуре, остальные',
      '  слева направо по критерию. Самый правый вариант может быть «прочее» (пустая подпись).',
      '- Силуэт: ветки слева направо в порядке времени («чем правее — тем позже»). Каждая ветка: одно имя сверху, один или',
      '  несколько выходов снизу — адрес (имя следующей ветки) или конец. Прыжок в середину ветки невозможен: адрес ведёт на её начало.',
      '- Верхняя полоса силуэта — «шапка»: по ней за секунды видно, как называется задача, из скольких частей она и как называется',
      '  каждая. Имена веток уникальны. Ветка — смысловая часть задачи: дай ей понятное имя.',
      '- Примитив — один шампур от заголовка до конца, для простых алгоритмов (5–15 икон). Сложное — силуэтом.',
      '- Конец один. Ранний выход из алгоритма — прыжок на последнюю ветку, не второй «Конец».',
      '- Заголовок — точное название алгоритма; слово «Начало» в нём писать нельзя.',
      '',
      'Линии',
      '- Пересечений и разрывов линий нет вообще. Раскладка добивается этого сама при соблюдении ограничений ниже.',
      '- Линии только прямые, под прямыми углами. Иконы стоят только на вертикалях, идущих вниз: на горизонтали и на линии вверх',
      '  иконы не ставят. Стрелками отмечены только линии, идущие вверх (повтор) — прочие линии без стрелок.',
      '- Слияние сверху: линия идёт вниз до горизонтали и дальше только влево. Слияние на вертикаль: после него путь идёт вниз.',
      '- Один вход в икону: на каждую икону ведёт одна линия.',
      '- Повторяющееся не копируют, а сливают линии или выносят в отдельную схему (вставка).',
      '- Если правила спорят, приоритет такой: (1) основа — нет пересечений, нет выхода влево у вопроса; (2) главный маршрут на',
      '  шампуре; (3) меньше изломов линий; (4) меньше вертикалей. Ради краткости ергономику не нарушают.',
      '',
      'Циклы',
      "- «Для каждого» (loop): начало и конец цикла, вход в тело один, выходов может быть несколько. У нас ранний выход из тела не рисуется.",
      "- Веточный цикл (повтор ветки): адрес в эту же ветку или левее. Это единственный допустимый возврат на уровне силуэта,",
      "  он помечается знаком ↻ на адресе и на ветке, куда он ведёт — библиотека ставит знак сама.",
      '',
      'ПРАВИЛА БИБЛИОТЕКИ',
      "- Вопрос с отрицанием («Сбоев нет?», «Не совпадают?») — обе подписи с пояснением: down: 'да, сбоев нет',",
      "  right: 'нет, есть сбой'. Голое «нет» на отрицательный вопрос читается двояко. Это наше отступление от канона. Лучше спросить без отрицания.",
      `- Виды икон, ${KINDS}.`,
      "- Открытый вопрос владельцу — вид 'ask' с номером примечания; в notes — сам вопрос с вариантами.",
      '- Комментарии ДРАКОН (рядом с иконами) у нас — номера на иконах и нумерованные примечания под схемой (notes).',
      '- Тексты — по-русски, коротко; сообщения пользователю — в «ёлочках».',
      '- Схема — отдельная страница в docs/design/drakon/ рядом с библиотекой.',
      '',
      'ОГРАНИЧЕНИЯ РАСКЛАДКИ (нарушение — error в lint)',
      '- go(…) — только последним в своём пути.',
      '- go(…) нельзя внутри loop, choice и сливающегося вопроса (у которого no не кончается адресом).',
      '  Можно: в конце ветки силуэта и в конце no у вопроса-выхода (в том числе вложенного в такой no).',
      '- У вопроса-выхода (no кончается go) yes пуст: «да» — это иконы после вопроса.',
      '- end() — только последней иконой примитива или последней ветки силуэта.',
      "- В примитиве адрес — только '@end'; в силуэте — имя существующей ветки, точь-в-точь.",
    ].join('\n'),

    recipes: () => [
      'КАК ВЫРАЗИТЬ ТИПОВУЮ ЛОГИКУ',
      '',
      'Ранний выход (отказ):',
      "    D.q('Файл доступен?', { no: [D.act('«Файл занят»', 'stop'), D.go('@end')] })   // примитив",
      "    D.q('Файл доступен?', { no: [D.act('«Файл занят»', 'stop'), D.go('Ввод')] })   // силуэт",
      '  Путь «нет» — своя колонка справа; шампур продолжается иконами после вопроса.',
      '',
      'Если — иначе, затем общее продолжение:',
      "    D.q('Чертёж открыт?', { yes: [D.act('Взять открытый')], no: [D.act('Открыть невидимо')] })",
      '',
      'Необязательный шаг при «нет»:      D.q(\'Чертёж открыт?\', { no: [D.act(\'Открыть\')] })',
      "Необязательный шаг при «да»:       D.q('Есть сбои?', { yes: [D.act('Показать')] }) — но лучше перевернуть вопрос.",
      '',
      'Несколько вариантов:',
      "    D.choice('Формат листа', [['A4, A3', [D.act('Как есть')]], ['A2 и больше', [D.act('Вписать в A3')]]])",
      '  Первый вариант — на шампуре, все сливаются под выбором; адресов внутри нет.',
      '',
      'Для каждого элемента:',
      "    D.loop('Для каждого листа', [D.act('Отправить лист')])",
      "  Выход из цикла посередине не рисуется — копи сбои в цикле, решай после: D.q('Сбоев нет?', …).",
      '',
      "Вернуться и повторить: в силуэте go('Ранняя ветка'), обычно из no вопроса-выхода.",
      '',
      'Несколько выходов подряд: ставь вопросы-выходы друг под другом — ранние встанут правее поздних, линии не пересекутся.',
      '',
      "Кто делает:                        D.shelf('Inventor', 'Сохранить копию')",
      "Вызов другой схемы:                D.ins('Проверить имена', 'copy-Имена')  // ссылка на ветку силуэта с { id: 'copy' }",
      "Решение / вопрос на схеме:         D.act('Префикс от папки', 'new', 2)     // notes[1] — расшифровка",
      "Перенос строки:                    D.act('Первая строка\\nвторая')",
      '',
      'Ранний выход из всей схемы: конец один, поэтому — прыжок на последнюю ветку («Итог»):',
      "    D.q('Файл доступен?', { no: [D.act('«Файл занят»', 'stop'), D.go('Итог')] })",
      '',
      'Повторить часть алгоритма (веточный цикл): адрес в эту же ветку или левее — знак ↻ появится сам:',
      "    { name: 'Проверка', items: [ …, D.q('Всё верно?', { no: [D.act('Исправить'), D.go('Проверка')] }), D.go('Запись') ] }",
      '',
      'Логическое условие: не пиши «А и Б» в одной иконе, каждый операнд — свой вопрос. И — вопросы друг под другом на шампуре',
      '(при любом «нет» путь уходит вправо в отказ), ИЛИ — лесенкой: вопросы цепочкой, «да» уходит вправо к общему результату.',
      '',
      'Пропустить ветку: адрес, который ведёт мимо следующей справа ветки, — только из no вопроса-выхода (по условию). Ветка, на которую',
      'не ведёт ни один адрес, — недостижима (lint предупредит).',
      '',
      'Слишком широко: каждая колонка выхода и каждый вариант выбора — плюс ~236 px. Сожми: объедини мелкие действия,',
      'выбор с пустыми вариантами замени действием, кусок вынеси в отдельную схему и вызови через ins.',
      '',
      'Повторяющийся код схемы — обычный JS: const A = D.act, Q = D.q, G = D.go; функции, возвращающие массивы икон.',
    ].join('\n'),

    lint: () => [
      "Drakon.lint(схема) → [{ level: 'error' | 'warn', where: 'Ветка › икона', message }]. [] — годна.",
      'svg() и figure() пишут те же замечания в консоль; figure при исключении показывает его текст в контейнере.',
      '',
      'error «Адрес стоит не последним в пути.»                      → go(…) в конец своего массива; иконы после него убрать.',
      'error «Адрес внутри цикла, выбора или сливающегося вопроса…»  → вынести решение наружу: после loop/choice поставить',
      '                                                                вопрос-выход; у сливающегося q — сделать no выходом.',
      'error «Нет ветки «X».»                                         → опечатка в go(\'X\') или нет такой ветки; сравнение точное.',
      "error «В примитиве адрес — только '@end'.»                    → нужны переходы между частями — сделать силуэт.",
      'error «Конец — только последней иконой схемы или ветки.»       → end() только в конце примитива / последней ветки.',
      'error «У вопроса с адресом на «нет» путь «да» — … yes не нужен.» → иконы из yes перенести после вопроса.',
      'error «Последняя ветка кончается иконой «Конец».»              → добавить D.end() в конец последней ветки.',
      "error «Ветка кончается адресом следующей.»                     → добавить D.go('Следующая') в конец ветки.",
      'warn  «Вопрос с отрицанием: подпишите выходы…»                 → задать down и right с пояснением или убрать не/нет/без/ни.',
      'warn  «Выбор с одним вариантом — это действие.»                → заменить choice на act или q.',
      'error «Имя ветки повторяется: в схеме они уникальны.»          → переименовать: адрес ищет ветку по имени.',
      'warn  «В заголовке не пишут «Начало»…»                        → назвать алгоритм: «Печать чертежа», а не «Начало».',
      'warn  «Примитив — для простых алгоритмов (до 15 икон)…»        → разбить на ветки: silhouette, части — ins.',
      'warn  «Силуэт из одной ветки — это примитив.»                  → primitive, либо разбить на смысловые части.',
      'warn  «Веток не больше 16» / «В выборе не больше 16 вариантов» → разделить схему на несколько через ins.',
      'warn  «Ни один адрес не ведёт на эту ветку: до неё не дойти.»  → нужен go на неё или лишняя ветка; ветка недостижима.',
      'throw «Drakon: неизвестная икона «…»»                          → в путь попало не то: undefined, вложенный массив, опечатка.',
    ].join('\n'),

    scope: () => [
      'ЧТО УМЕЕТ И ЧЕГО НЕ УМЕЕТ БИБЛИОТЕКА (относительно языка ДРАКОН)',
      '',
      'Есть: заголовок/конец, действие, вопрос (шестиугольник), выбор + варианты, цикл «для каждого» (начало и конец цикла),',
      '      вставка, полка, имя ветки, адрес, нижняя и верхняя шины силуэта со стрелкой возврата, веточный цикл (↻),',
      '      выходы вопроса вправо в отдельную колонку, примечания номерами вместо иконы «комментарий», виды икон цветом.',
      '',
      'Нет — и что делать:',
      '- Циклы «пока» и «до» через вопрос со стрелкой вверх, цикл выбора. Заменяй: «для каждого» (loop), либо веточным циклом',
      "  (go в эту же ветку), либо вопросом-выходом с go на раннюю ветку.",
      '- Ранний выход и переход к следующему элементу внутри цикла «для каждого» (в теле go нельзя): копи сбои, решай после цикла.',
      '- Дополнительный вход (вторая икона «Заголовок» над веткой), параметры алгоритма, комментарий слева/справа от иконы.',
      '- Реальное время: пауза, таймер, синхронизатор, параллельный процесс, цикл ЖДАТЬ.',
      '- Вложенный выбор внутри выхода вопроса с адресом, адрес внутри цикла/выбора/сливающегося вопроса.',
      "- Ручная раскладка и произвольные линии: человек линий не рисует, как и в ДРАКОН-конструкторе. Не хватает икон или сложная",
      '  топология — сначала упрости схему, разбей на ветки и вставки.',
    ].join('\n'),

    page: () => [
      'ШАБЛОН СТРАНИЦЫ (рядом с drakon.js и drakon.css)',
      '',
      '<!doctype html>',
      '<html lang="ru"><head>',
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>Логика печати</title>',
      '<link rel="stylesheet" href="drakon.css">',
      '</head><body>',
      '<div id="legend"></div>',
      '<div id="fig"></div>',
      '<script src="drakon.js" charset="utf-8"><\/script>',
      '<script>',
      '  const D = Drakon;',
      "  const scheme = D.silhouette('Печать', [ /* ветки */ ], { id: 'print', notes: [] });",
      "  document.getElementById('legend').innerHTML = D.legend({ new: 'решено — сделать', ask: 'вопрос владельцу', human: 'делает человек', stop: 'отказ, откат' });",
      "  D.figure(document.getElementById('fig'), scheme);",
      '<\/script>',
      '</body></html>',
      '',
      '- charset обязателен: без него локальный сервер отдаёт кириллицу кракозябрами.',
      '- Работает файлом (file://) и через python -m http.server в этой папке.',
      "- Артефакт claude.ai: публиковать страницу с files { 'drakon.js': …, 'drakon.css': … }.",
      '- drakon.css задаёт только вид схем (токены --dk-*, светлая и тёмная тема); фон и шрифт страницы — свои.',
      '- Несколько схем на странице — несколько контейнеров и вызовов figure; разные id у силуэтов.',
    ].join('\n'),

    node: () => [
      'БЕЗ БРАУЗЕРА (node) — проверить схему или получить SVG в файл',
      '',
      "    const Drakon = require('./drakon.js');      // также задаёт globalThis.Drakon",
      "    const s = Drakon.silhouette('…', [ … ]);",
      '    console.log(Drakon.lint(s));',
      "    require('fs').writeFileSync('scheme.svg', Drakon.svg(s));",
      '',
      '    node -e "console.log(require(\'./drakon.js\').help(\'all\'))"',
      '',
      '- Без DOM ширина текста считается приближённо (6.6 px на знак), переносы чуть отличаются от браузера.',
      '- SVG без drakon.css — без цветов: всё оформление в классах dk-*. Для отдельного файла вставь drakon.css в <style>.',
    ].join('\n'),

    example: () => [
      'ПОЛНЫЙ ПРИМЕР — силуэт из трёх веток (lint чистый)',
      '',
      "    D.silhouette('Заметка машины', [",
      "      { name: 'Ввод', items: [",
      "        D.act('Человек набирает текст', 'human'),",
      "        D.q('Текст набран?', { no: [D.act('Кнопка «Сохранить» неактивна'), D.go('Ввод')] }),",
      "        D.go('Запись') ] },",
      "      { name: 'Запись', items: [",
      "        D.act('Перечитать machine.json'),",
      "        D.q('Файл доступен?', { no: [D.act('«Не записано: файл занят»', 'stop'), D.go('Ввод')] }),",
      "        D.act('Добавить заметку и записать', 'new', 1),",
      "        D.go('Итог') ] },",
      "      { name: 'Итог', items: [",
      "        D.act('Обновить раздел «Записи» на всех станциях'),",
      '        D.end() ] },',
      "    ], { id: 'note', notes: ['Запись — целиком новым файлом рядом и переименованием.'] })",
      '',
      "Ещё примеры — index.html (справочник) в этом репозитории.",
    ].join('\n'),
  };

  function apiText(name) {
    const a = API[name];
    const out = [`${a.sig}`, `  ${a.does}`];
    if (a.args && a.args.length) out.push('  Аргументы:', ...a.args.map(([k, v]) => `    ${k} — ${v}`));
    if (a.returns) out.push(`  Возвращает: ${a.returns}`);
    if (a.example) out.push('  Пример:', ...a.example.split('\n').map((l) => '      ' + l));
    if (a.notes && a.notes.length) out.push('  Важно:', ...a.notes.map((n) => '    - ' + n));
    return out.join('\n');
  }

  /** Справка строкой: help() — обзор, help('q') — функция, help('rules' | 'recipes' | 'lint' | 'scope' | 'page' | 'node' | 'example' | 'all'). */
  function help(topic) {
    const key = String(topic || 'overview').trim().replace(/^Drakon\./, '').replace(/\s*\(.*$/, '');
    if (key === 'all')
      return [GUIDE.overview(), GUIDE.rules(), GUIDE.recipes(), 'ФУНКЦИИ ПОДРОБНО', ...Object.keys(API).map(apiText),
        GUIDE.lint(), GUIDE.scope(), GUIDE.page(), GUIDE.node(), GUIDE.example()].join('\n\n');
    if (key === 'lint') return apiText('lint') + '\n\n' + GUIDE.lint(); // и функция, и таблица сообщений
    if (API[key]) return apiText(key);
    if (GUIDE[key]) return GUIDE[key]();
    return `Нет раздела «${topic}». Есть: ${Object.keys(API).join(', ')}; ${Object.keys(GUIDE).join(', ')}, all.`;
  }

  const Drakon = { version: VERSION, act, ins, shelf, q, choice, loop, go, end, primitive, silhouette, svg, figure, legend, lint, help, api: API, defaults: DEFAULTS };
  global.Drakon = Drakon;
  if (typeof module !== 'undefined' && module.exports) module.exports = Drakon;
})(typeof window !== 'undefined' ? window : globalThis);
