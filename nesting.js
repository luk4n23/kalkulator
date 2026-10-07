/* ============================================================
   ULAMEX — Raport blachy (poglądowy nesting z pliku DXF)
   Własny parser DXF (bez bibliotek), prosty układ w rzędach.
   ============================================================ */

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var fmt0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
  var fmt1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });

  // Sekcja raportu nie zawsze jest na stronie — wychodzimy, gdy jej brak.
  if (!$('dxf-file')) return;

  var state = { parsed: null, fileName: '' };

  /* ---------- Parser DXF ---------- */
  function toNum(arr) { return (arr && arr.length) ? parseFloat(String(arr[0]).replace(',', '.')) : null; }

  function arcPts(cx, cy, r, a0, a1) {
    var start = a0, end = a1;
    if (end <= start) end += 360;
    var steps = Math.max(6, Math.ceil((end - start) / 12));
    var pts = [];
    for (var s = 0; s <= steps; s++) {
      var ang = (start + (end - start) * s / steps) * Math.PI / 180;
      pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang)]);
    }
    return pts;
  }

  function parseDXF(text) {
    var lines = text.split(/\r\n|\r|\n/);
    // pary (kod grupy, wartość) — odporne na przesunięcia
    var toks = [];
    for (var k = 0; k < lines.length - 1; k++) {
      var c = lines[k].trim();
      if (!/^-?\d+$/.test(c)) continue;
      toks.push([parseInt(c, 10), lines[k + 1]]);
      k++;
    }
    // encje
    var ents = [], cur = null;
    for (var t = 0; t < toks.length; t++) {
      var code = toks[t][0], val = toks[t][1];
      if (code === 0) { if (cur) ents.push(cur); cur = { type: String(val).trim().toUpperCase(), g: {} }; }
      else if (cur) { if (!cur.g[code]) cur.g[code] = []; cur.g[code].push(String(val).trim()); }
    }
    if (cur) ents.push(cur);

    var prims = [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function ext(x, y) {
      if (x == null || y == null || isNaN(x) || isNaN(y)) return;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    function layerOf(e) { return e.g[8] ? e.g[8][0] : '0'; }
    function addPoly(pts, closed, layer) {
      var clean = pts.filter(function (p) { return p[0] != null && p[1] != null && !isNaN(p[0]) && !isNaN(p[1]); });
      if (clean.length < 2) return;
      prims.push({ t: 'poly', pts: clean, closed: closed, layer: layer });
      for (var p = 0; p < clean.length; p++) ext(clean[p][0], clean[p][1]);
    }

    for (var idx = 0; idx < ents.length; idx++) {
      var e = ents[idx], ty = e.type, layer = layerOf(e);
      if (ty === 'LINE') {
        var x1 = toNum(e.g[10]), y1 = toNum(e.g[20]), x2 = toNum(e.g[11]), y2 = toNum(e.g[21]);
        if ([x1, y1, x2, y2].every(function (v) { return v != null && !isNaN(v); })) {
          prims.push({ t: 'line', x1: x1, y1: y1, x2: x2, y2: y2, layer: layer });
          ext(x1, y1); ext(x2, y2);
        }
      } else if (ty === 'CIRCLE') {
        var cx = toNum(e.g[10]), cy = toNum(e.g[20]), r = toNum(e.g[40]);
        if (cx != null && cy != null && r != null) {
          prims.push({ t: 'circle', cx: cx, cy: cy, r: r, layer: layer });
          ext(cx - r, cy); ext(cx + r, cy); ext(cx, cy - r); ext(cx, cy + r);
        }
      } else if (ty === 'ARC') {
        var acx = toNum(e.g[10]), acy = toNum(e.g[20]), ar = toNum(e.g[40]), a0 = toNum(e.g[50]), a1 = toNum(e.g[51]);
        if (acx != null && acy != null && ar != null && a0 != null && a1 != null) addPoly(arcPts(acx, acy, ar, a0, a1), false, layer);
      } else if (ty === 'LWPOLYLINE') {
        var xs = e.g[10] || [], ys = e.g[20] || [], n = Math.min(xs.length, ys.length), pts = [];
        for (var v = 0; v < n; v++) pts.push([parseFloat(xs[v].replace(',', '.')), parseFloat(ys[v].replace(',', '.'))]);
        addPoly(pts, !!(e.g[70] && (parseInt(e.g[70][0], 10) & 1)), layer);
      } else if (ty === 'POLYLINE') {
        var pts2 = [], j = idx + 1;
        while (j < ents.length && ents[j].type === 'VERTEX') {
          var vx = toNum(ents[j].g[10]), vy = toNum(ents[j].g[20]);
          if (vx != null && vy != null) pts2.push([vx, vy]);
          j++;
        }
        addPoly(pts2, !!(e.g[70] && (parseInt(e.g[70][0], 10) & 1)), layer);
        idx = j - 1;
      } else if (ty === 'SPLINE') {
        var fx = e.g[11] || [], fy = e.g[21] || [];
        if (fx.length < 2) { fx = e.g[10] || []; fy = e.g[20] || []; }
        var nn = Math.min(fx.length, fy.length), sp = [];
        for (var w = 0; w < nn; w++) sp.push([parseFloat(fx[w].replace(',', '.')), parseFloat(fy[w].replace(',', '.'))]);
        addPoly(sp, false, layer);
      } else if (ty === 'ELLIPSE') {
        var ecx = toNum(e.g[10]), ecy = toNum(e.g[20]), mx = toNum(e.g[11]), my = toNum(e.g[21]), ratio = toNum(e.g[40]);
        var p0 = e.g[41] ? toNum(e.g[41]) : 0, p1 = e.g[42] ? toNum(e.g[42]) : (2 * Math.PI);
        if (ecx != null && ecy != null && mx != null && my != null && ratio != null) {
          var maj = Math.sqrt(mx * mx + my * my), ang = Math.atan2(my, mx), minr = maj * ratio, ep = [];
          var st = Math.max(8, Math.ceil(Math.abs(p1 - p0) / 0.2));
          for (var q = 0; q <= st; q++) {
            var tt = p0 + (p1 - p0) * q / st, lx = maj * Math.cos(tt), ly = minr * Math.sin(tt);
            ep.push([ecx + lx * Math.cos(ang) - ly * Math.sin(ang), ecy + lx * Math.sin(ang) + ly * Math.cos(ang)]);
          }
          addPoly(ep, false, layer);
        }
      }
    }

    if (!prims.length || minX === Infinity || maxX <= minX || maxY <= minY) return null;
    return { prims: prims, minX: minX, minY: minY, maxX: maxX, maxY: maxY, w: maxX - minX, h: maxY - minY };
  }

  /* ---------- Układ na blasze (prostokątny, w rzędach) ---------- */
  function computeNest(pw, ph, sw, sh, gap, margin) {
    var uw = sw - 2 * margin, uh = sh - 2 * margin;
    function fit(a, b) {
      if (a <= 0 || b <= 0 || uw <= 0 || uh <= 0) return { cols: 0, rows: 0, n: 0 };
      var cols = Math.floor((uw + gap) / (a + gap));
      var rows = Math.floor((uh + gap) / (b + gap));
      cols = Math.max(0, cols); rows = Math.max(0, rows);
      return { cols: cols, rows: rows, n: cols * rows };
    }
    var A = fit(pw, ph), B = fit(ph, pw);
    var rot = B.n > A.n, best = rot ? B : A;
    return { perSheet: best.n, cols: best.cols, rows: best.rows, rotated: rot, pw: rot ? ph : pw, ph: rot ? pw : ph };
  }

  /* ---------- Rysowanie SVG ---------- */
  function col(layer) {
    var L = (layer || '').toUpperCase();
    if (L.indexOf('ENGRAVE') >= 0 || L.indexOf('GRAWER') >= 0) return '#1565c0';
    if (L.indexOf('FOLD') >= 0 || L.indexOf('GI') === 0) return '#E2001A';
    return '#1c1e22';
  }
  function r3(n) { return Math.round(n * 1000) / 1000; }

  function partSVG(d) {
    var w = d.w, h = d.h;
    function X(x) { return r3(x - d.minX); }
    function Y(y) { return r3(h - (y - d.minY)); } // odbicie Y (DXF ma Y w górę)
    var out = [];
    for (var i = 0; i < d.prims.length; i++) {
      var p = d.prims[i], c = col(p.layer), ve = ' vector-effect="non-scaling-stroke"';
      if (p.t === 'line') out.push('<line x1="' + X(p.x1) + '" y1="' + Y(p.y1) + '" x2="' + X(p.x2) + '" y2="' + Y(p.y2) + '" stroke="' + c + '"' + ve + '/>');
      else if (p.t === 'circle') out.push('<circle cx="' + X(p.cx) + '" cy="' + Y(p.cy) + '" r="' + r3(p.r) + '" fill="none" stroke="' + c + '"' + ve + '/>');
      else if (p.t === 'poly') {
        var pts = p.pts.map(function (pt) { return X(pt[0]) + ',' + Y(pt[1]); }).join(' ');
        out.push('<' + (p.closed ? 'polygon' : 'polyline') + ' points="' + pts + '" fill="none" stroke="' + c + '"' + ve + '/>');
      }
    }
    var pad = Math.max(w, h) * 0.04 + 1;
    return '<svg viewBox="' + r3(-pad) + ' ' + r3(-pad) + ' ' + r3(w + 2 * pad) + ' ' + r3(h + 2 * pad) + '" ' +
      'preserveAspectRatio="xMidYMid meet" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" ' +
      'style="width:100%;height:100%;display:block">' + out.join('') + '</svg>';
  }

  function sheetSVG(nest, sw, sh, gap, margin) {
    var pw = nest.pw, ph = nest.ph, rects = [], drawn = 0, maxDraw = 700;
    for (var r = 0; r < nest.rows && drawn < maxDraw; r++) {
      for (var c = 0; c < nest.cols && drawn < maxDraw; c++) {
        var x = margin + c * (pw + gap), y = margin + r * (ph + gap);
        rects.push('<rect x="' + r3(x) + '" y="' + r3(y) + '" width="' + r3(pw) + '" height="' + r3(ph) +
          '" rx="' + r3(Math.min(pw, ph) * 0.06) + '" fill="rgba(226,0,26,0.18)" stroke="#E2001A" vector-effect="non-scaling-stroke"/>');
        drawn++;
      }
    }
    return '<svg viewBox="0 0 ' + r3(sw) + ' ' + r3(sh) + '" preserveAspectRatio="xMidYMid meet" style="width:100%;height:100%;display:block">' +
      '<rect x="0" y="0" width="' + r3(sw) + '" height="' + r3(sh) + '" fill="#f2f3f5" stroke="#1c1e22" stroke-width="2" vector-effect="non-scaling-stroke"/>' +
      rects.join('') + '</svg>';
  }

  /* ---------- Pomocnicze ---------- */
  function arkuszy(n) {
    n = Math.abs(n); var u = n % 10, dd = n % 100;
    if (n === 1) return 'arkusz';
    if (u >= 2 && u <= 4 && !(dd >= 12 && dd <= 14)) return 'arkusze';
    return 'arkuszy';
  }
  function sheetDims() {
    var sel = $('nest-sheet').value;
    if (sel === 'custom') return [parseFloat($('nest-sheet-w').value), parseFloat($('nest-sheet-h').value)];
    var m = sel.split('x');
    return [parseFloat(m[0]), parseFloat(m[1])];
  }

  /* ---------- Przeliczenie + render ---------- */
  function recompute() {
    var d = state.parsed;
    if (!d) { $('raport-result').hidden = true; $('raport-placeholder').hidden = false; return; }

    var dims = sheetDims(), sw = dims[0], sh = dims[1];
    var gap = parseFloat($('nest-gap').value); if (isNaN(gap) || gap < 0) gap = 0;
    var margin = parseFloat($('nest-margin').value); if (isNaN(margin) || margin < 0) margin = 0;
    var qty = parseInt($('nest-qty').value, 10); if (isNaN(qty) || qty < 1) qty = 1;

    $('raport-placeholder').hidden = true;
    $('raport-result').hidden = false;
    $('part-dims').textContent = fmt1.format(d.w) + ' × ' + fmt1.format(d.h) + ' mm';
    $('part-svg').innerHTML = partSVG(d);

    if (!(sw > 0) || !(sh > 0)) {
      $('sheet-dims').textContent = '';
      $('sheet-svg').innerHTML = '';
      $('raport-stats').innerHTML = '<p class="stat-warn">Podaj poprawny rozmiar blachy (szerokość i wysokość w mm).</p>';
      state.last = null;
      return;
    }

    var nest = computeNest(d.w, d.h, sw, sh, gap, margin);
    $('sheet-dims').textContent = fmt0.format(sw) + ' × ' + fmt0.format(sh) + ' mm';
    $('sheet-svg').innerHTML = sheetSVG(nest, sw, sh, gap, margin);

    if (nest.perSheet <= 0) {
      $('raport-stats').innerHTML = '<p class="stat-warn">Detal ' + fmt1.format(d.w) + ' × ' + fmt1.format(d.h) +
        ' mm nie mieści się na blasze ' + fmt0.format(sw) + ' × ' + fmt0.format(sh) +
        ' mm przy tym marginesie. Wybierz większą blachę albo zmniejsz margines/odstęp.</p>';
      state.last = null;
      return;
    }

    var sheets = Math.ceil(qty / nest.perSheet);
    var util = (d.w * d.h * nest.perSheet) / (sw * sh) * 100;
    $('raport-stats').innerHTML =
      stat('Na 1 arkusz', fmt0.format(nest.perSheet) + ' szt') +
      stat('Układ', nest.cols + ' × ' + nest.rows + (nest.rotated ? ' (obrót 90°)' : '')) +
      stat('Zamówienie ' + fmt0.format(qty) + ' szt', fmt0.format(sheets) + ' ' + arkuszy(sheets)) +
      stat('Wykorzystanie', '~' + fmt1.format(util) + '%');

    state.last = { d: d, sw: sw, sh: sh, gap: gap, nest: nest, qty: qty, sheets: sheets, util: util };
  }

  function stat(label, val) {
    return '<div class="stat"><span>' + label + '</span><b>' + val + '</b></div>';
  }

  /* ---------- Wczytanie pliku ---------- */
  function showErr(msg) { var e = $('err-dxf'); e.textContent = msg; e.hidden = false; }
  function clearErr() { var e = $('err-dxf'); e.hidden = true; e.textContent = ''; }

  function handleFile(file) {
    if (!file) return;
    state.fileName = file.name;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var d = null;
      try { d = parseDXF(ev.target.result); } catch (err) { d = null; }
      if (!d) {
        state.parsed = null;
        showErr('Nie udało się odczytać kształtu z „' + file.name + '". Upewnij się, że to plik DXF (nie DWG, PDF ani obrazek).');
        $('raport-result').hidden = true; $('raport-placeholder').hidden = false;
        $('drop-text').textContent = 'Wybierz plik DXF (albo przeciągnij tutaj)';
        return;
      }
      clearErr();
      state.parsed = d;
      $('drop-text').textContent = file.name + '  ✓';
      recompute();
    };
    reader.onerror = function () { showErr('Nie udało się wczytać pliku.'); };
    reader.readAsText(file);
  }

  /* ---------- Kopiowanie rozpiski ---------- */
  function copyRaport() {
    var s = state.last;
    if (!s) { flashRaport('Najpierw wgraj plik DXF.'); return; }
    var lines = [
      'Rozpiska blachy ULAMEX',
      '----------------------',
      'Detal: ' + fmt1.format(s.d.w) + ' × ' + fmt1.format(s.d.h) + ' mm',
      'Blacha: ' + fmt0.format(s.sw) + ' × ' + fmt0.format(s.sh) + ' mm',
      'Na 1 arkusz wchodzi: ' + fmt0.format(s.nest.perSheet) + ' szt (układ ' + s.nest.cols + ' × ' + s.nest.rows + (s.nest.rotated ? ', obrót 90°' : '') + ')',
      'Zamówienie ' + fmt0.format(s.qty) + ' szt: ' + fmt0.format(s.sheets) + ' ' + arkuszy(s.sheets),
      'Wykorzystanie arkusza: ~' + fmt1.format(s.util) + '% (układ poglądowy, detale w rzędach)',
      '',
      'Kontakt: quote@ulamex.com, tel. +48 504 424 761'
    ];
    var text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flashRaport('Skopiowano rozpiskę.'); }, function () { fallbackCopy(text); });
    } else { fallbackCopy(text); }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); flashRaport('Skopiowano rozpiskę.'); } catch (e) { flashRaport('Nie udało się skopiować.'); }
    document.body.removeChild(ta);
  }
  var raportTimer = null;
  function flashRaport(msg) {
    var el = $('raport-copy-ok'); el.textContent = msg; el.hidden = false;
    if (raportTimer) clearTimeout(raportTimer);
    raportTimer = setTimeout(function () { el.hidden = true; }, 3000);
  }

  /* ---------- Zdarzenia ---------- */
  var drop = $('dxf-drop');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('drag'); }); });
  ['dragleave', 'dragend'].forEach(function (ev) { drop.addEventListener(ev, function () { drop.classList.remove('drag'); }); });
  drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  $('dxf-file').addEventListener('change', function (e) { if (e.target.files[0]) handleFile(e.target.files[0]); });

  $('nest-sheet').addEventListener('change', function () {
    $('nest-custom').hidden = $('nest-sheet').value !== 'custom';
    recompute();
  });
  ['nest-sheet-w', 'nest-sheet-h', 'nest-gap', 'nest-margin', 'nest-qty'].forEach(function (id) {
    $(id).addEventListener('input', recompute);
  });
  $('btn-copy-raport').addEventListener('click', copyRaport);
})();
