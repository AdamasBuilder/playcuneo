/**
 * mech-memory.js — modulo "coppie" (memory) per il motore play cuneo.
 * Il gioco importa questo file e passa: symbols (disegni), griglia, testi.
 */
(function (global) {
  'use strict';
  global.PlayCuneoMechanics = global.PlayCuneoMechanics || {};

  global.PlayCuneoMechanics.memory = function (opts) {
    opts = opts || {};
    var SYMBOLS = opts.symbols || {};
    var KEYS = Object.keys(SYMBOLS);
    var COLS = opts.cols || 3, ROWS = opts.rows || 4;
    var PAIRS = opts.pairs || Math.floor(COLS * ROWS / 2);
    var back = opts.back || {};

    var cells = [], g = { x: 0, y: 0, cw: 0, ch: 0, gap: 10 };
    var flipA = -1, flipB = -1, lockT = 0, found = 0;

    function shuffle(a) {
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    function layout(W, H) {
      var pad = Math.max(12, Math.min(W * 0.05, 20));
      var maxW = Math.min(W - pad * 2, 400);
      var top = Math.min(H * 0.16, 130), bottom = Math.min(H * 0.92, H - 40);
      g.gap = Math.max(7, Math.min(12, W * 0.022));
      g.cw = (maxW - g.gap * (COLS - 1)) / COLS;
      g.ch = (bottom - top - g.gap * (ROWS - 1)) / ROWS;
      var cell = Math.min(g.cw, g.ch * 1.25);
      if (cell < g.cw) { var sh = cell / g.cw; g.cw = cell; g.ch *= sh; }
      var totalW = g.cw * COLS + g.gap * (COLS - 1);
      var totalH = g.ch * ROWS + g.gap * (ROWS - 1);
      g.x = (W - totalW) / 2;
      g.y = top + ((bottom - top) - totalH) / 2;
    }
    function cellRect(i) {
      return {
        x: g.x + (i % COLS) * (g.cw + g.gap) + g.cw / 2,
        y: g.y + Math.floor(i / COLS) * (g.ch + g.gap) + g.ch / 2
      };
    }

    return {
      init: function () {
        var deck = [];
        for (var p = 0; p < PAIRS; p++) { var k = KEYS[p % KEYS.length]; deck.push(k); deck.push(k); }
        shuffle(deck);
        cells = deck.map(function (k) { return { kind: k, up: false, done: false, pop: 0 }; });
        flipA = flipB = -1; lockT = 0; found = 0;
      },
      update: function (api, dt) {
        if (lockT > 0) {
          lockT -= dt;
          if (lockT <= 0 && flipA >= 0 && flipB >= 0) {
            cells[flipA].up = false; cells[flipB].up = false;
            flipA = flipB = -1;
          }
        }
        for (var i = 0; i < cells.length; i++) cells[i].pop = Math.max(0, cells[i].pop - dt * 4);
        api.setProgress(found, PAIRS);
      },
      tap: function (api, x, y) {
        if (lockT > 0) return;
        layout(api.W, api.H);
        for (var i = 0; i < cells.length; i++) {
          var c = cellRect(i);
          if (Math.abs(x - c.x) < g.cw / 2 && Math.abs(y - c.y) < g.ch / 2) {
            var cell = cells[i];
            if (cell.up || cell.done) return;
            cell.up = true; cell.pop = 1;
            if (flipA < 0) { flipA = i; api.sfx('tick'); return; }
            flipB = i;
            if (cells[flipA].kind === cell.kind) {
              cells[flipA].done = cell.done = true;
              found++; api.setProgress(found, PAIRS);
              api.addScore(100); api.sfx('hit');
              flipA = flipB = -1;
              if (found >= PAIRS) { api.addScore(Math.ceil(api.timeLeft) * 20); api.end('done'); }
            } else {
              api.addScore(-10); api.shake(5); api.sfx('miss');
              lockT = 0.62;
            }
            return;
          }
        }
      },
      draw: function (api, t) {
        layout(api.W, api.H);
        var ctx = api.ctx;
        for (var i = 0; i < cells.length; i++) {
          var c = cellRect(i), cell = cells[i];
          var sx = cell.up && cell.pop > 0.5 ? api.clamp((1 - cell.pop) * 2, 0.1, 1) : 1;
          var x = c.x - g.cw / 2, y = c.y - g.ch / 2, w = g.cw, h = g.ch;
          ctx.save();
          ctx.translate(c.x, c.y); ctx.scale(sx, 1); ctx.translate(-c.x, -c.y);
          var grad = ctx.createLinearGradient(x, y, x + w, y + h);
          if (!cell.up) {
            grad.addColorStop(0, back.c1 || '#2b1d33'); grad.addColorStop(1, back.c2 || '#1b1222');
          } else if (cell.done) {
            grad.addColorStop(0, 'rgba(255,205,120,0.22)'); grad.addColorStop(1, 'rgba(255,160,70,0.08)');
          } else {
            grad.addColorStop(0, 'rgba(255,255,255,0.13)'); grad.addColorStop(1, 'rgba(255,255,255,0.05)');
          }
          ctx.fillStyle = grad; api.rr(x, y, w, h, 14); ctx.fill();
          ctx.strokeStyle = cell.done ? 'rgba(255,208,138,0.9)'
            : (cell.up ? 'rgba(255,215,160,0.22)' : 'rgba(255,190,110,0.30)');
          ctx.lineWidth = cell.done ? 2.5 : 1.5; api.rr(x, y, w, h, 14); ctx.stroke();
          ctx.restore();

          if (!cell.up) {
            if (back.mark) {
              ctx.save(); ctx.globalAlpha = 0.42;
              back.mark(ctx, c.x, c.y, Math.min(w, h) * 0.22, t * 0.2 + i);
              ctx.restore();
            }
          } else {
            (SYMBOLS[cell.kind])(ctx, c.x, c.y, Math.min(w, h) * 0.34 * (1 + cell.pop * 0.12), t + i);
          }
        }
      },
      boxes: function (api) {
        layout(api.W, api.H);
        var out = [];
        for (var i = 0; i < cells.length; i++) {
          if (cells[i].up || cells[i].done) continue;
          var c = cellRect(i);
          out.push({ x: c.x - g.cw / 2, y: c.y - g.ch / 2, w: g.cw, h: g.ch });
        }
        return out;
      },
      hud: function () { return { left: 'COPPIE ' + found + '/' + PAIRS }; },
      result: function (api) {
        return {
          verdict: found >= PAIRS ? (opts.winVerdict || 'TUTTE LE COPPIE!') : 'TEMPO SCADUTO',
          big: String(api.score),
          sub: 'PUNTI \u00b7 ' + found + '/' + PAIRS + ' ' + (opts.subLabel || 'COPPIE TROVATE')
        };
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
