/**
 * mech-sort.js — modulo "smista" per il motore play cuneo.
 * Le card scendono e il giocatore le spinge (o tocca il cesto) verso il lato giusto.
 *
 * opts.cards      [{ t:'testo', good:true|false }]
 * opts.target     quante card smistare (default: tutte)
 * opts.left       testo cesto sinistro (default 'PROBLEMA')
 * opts.right      testo cesto destro (default 'HA VALORE')
 * opts.goodSide   'right' (default) o 'left'
 * opts.points     punti a risposta giusta (default 100)
 * opts.penalty    penalità a risposta sbagliata (default 25)
 * opts.goodColor  / opts.badColor  colori dei cesti
 * opts.winVerdict / opts.subLabel  testi della schermata finale
 */
(function (global) {
  'use strict';
  global.PlayCuneoMechanics = global.PlayCuneoMechanics || {};

  global.PlayCuneoMechanics.sort = function (opts) {
    opts = opts || {};
    var CARDS = (opts.cards || []).slice(0);
    var TARGET = opts.target || CARDS.length;
    var LEFT = opts.left || 'PROBLEMA';
    var RIGHT = opts.right || 'HA VALORE';
    var GOOD = opts.goodSide === 'left' ? 'left' : 'right';
    var PTS = opts.points || 100;
    var PEN = opts.penalty === undefined ? 25 : opts.penalty;
    var C_GOOD = opts.goodColor || '#9fe8c4';
    var C_BAD = opts.badColor || '#f0b49a';

    var stack = [], cur = null, cardY = 0, revealed = null;
    var correct = 0, wrong = 0;
    var BIN = { w: 0, h: 0, y: 0, lx: 0, rx: 0 };

    function layout(W, H) {
      var pad = Math.max(10, W * 0.035), gap = Math.max(8, W * 0.03);
      BIN.w = (W - pad * 2 - gap) / 2;
      BIN.h = Math.min(H * 0.155, 108);
      BIN.y = H - BIN.h - Math.max(26, H * 0.03);
      BIN.lx = pad; BIN.rx = pad + BIN.w + gap;
    }
    function binRect(side) { return { x: side === 'left' ? BIN.lx : BIN.rx, y: BIN.y, w: BIN.w, h: BIN.h }; }
    function shuffled() {
      for (var i = stack.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)); var t = stack[i]; stack[i] = stack[j]; stack[j] = t;
      }
    }
    function nextCard(api) {
      if (!stack.length) { api.end('done'); return; }
      cur = stack.shift();
      cardY = api.H * 0.34;
    }
    function resolve(api, pickedGood) {
      if (!cur) return;
      var ok = (pickedGood === cur.good);
      var wasGood = cur.good;
      if (ok) { correct++; api.addScore(PTS); api.sfx('hit'); }
      else { wrong++; api.addScore(-PEN); api.shake(6); api.sfx('miss'); }
      api.setProgress(correct + wrong, TARGET);
      revealed = { good: wasGood, ok: ok, t: 0.45 };
      cur = null;
      setTimeout(function () {
        if (api.state !== 'PLAY') return;
        revealed = null;
        if (correct + wrong >= TARGET) { api.end('done'); return; }
        nextCard(api);
      }, 460);
    }

    return {
      init: function (api) {
        stack = CARDS.map(function (c) { return { t: c.t, good: !!c.good }; });
        shuffled();
        correct = 0; wrong = 0; revealed = null; cur = null;
        api.setProgress(0, TARGET);
        nextCard(api);
      },
      update: function (api, dt) {
        if (revealed) revealed.t = Math.max(0, revealed.t - dt);
        if (!cur) return;
        layout(api.W, api.H);
        var ramp = 1 + api.roundT / 20;
        cardY += (13 + 9 * ramp) * dt;
        var maxY = BIN.y - 62;
        if (cardY > maxY) cardY = maxY;
        if (cardY < api.H * 0.30) cardY = api.H * 0.30;
      },
      tap: function (api, x, y) {
        if (!cur) return;
        layout(api.W, api.H);
        var l = binRect('left'), r = binRect('right');
        if (x >= l.x && x <= l.x + l.w && y >= l.y && y <= l.y + l.h) resolve(api, GOOD === 'left');
        else if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) resolve(api, GOOD === 'right');
      },
      drag: function (api, x) {
        if (!cur) return;
        if (x < api.W * 0.34) resolve(api, GOOD === 'left');
        else if (x > api.W * 0.66) resolve(api, GOOD === 'right');
      },
      draw: function (api, t) {
        layout(api.W, api.H);
        var ctx = api.ctx;
        /* cesti */
        [['left', LEFT], ['right', RIGHT]].forEach(function (pair) {
          var b = binRect(pair[0]);
          var isGood = (pair[0] === GOOD);
          var col = isGood ? C_GOOD : C_BAD;
          var rgb = isGood ? 'rgba(127,227,176,' : 'rgba(240,180,154,';
          ctx.fillStyle = rgb + '0.14)'; api.rr(b.x, b.y, b.w, b.h, 18); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 2.5; api.rr(b.x, b.y, b.w, b.h, 18); ctx.stroke();
          ctx.fillStyle = col;
          api.setFont('800', api.fitSize(pair[1], '800', 15, b.w - 18));
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(pair[1], b.x + b.w / 2, b.y + b.h / 2 + 1);
        });
        /* card */
        if (cur) {
          var cw = Math.min(api.W * 0.82, 330), ch = Math.min(96, api.H * 0.13);
          var x = api.W / 2 - cw / 2, y = cardY - ch / 2;
          ctx.fillStyle = 'rgba(0,0,0,0.30)'; api.rr(x + 3, y + 5, cw, ch, 18); ctx.fill();
          var g = ctx.createLinearGradient(x, y, x, y + ch);
          g.addColorStop(0, opts.cardTop || '#1d2a1d'); g.addColorStop(1, opts.cardBottom || '#131a13');
          ctx.fillStyle = g; api.rr(x, y, cw, ch, 18); ctx.fill();
          ctx.strokeStyle = opts.cardBorder || 'rgba(126,211,33,0.55)'; ctx.lineWidth = 2.5;
          api.rr(x, y, cw, ch, 18); ctx.stroke();
          api.setFont('700', api.fitSize(cur.t, '700', 19, cw - 34));
          ctx.fillStyle = opts.cardInk || '#f2fff2';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var lines = api.wrapLines(cur.t, cw - 30);
          var sy = y + ch / 2 - (lines.length - 1) * 11;
          for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], api.W / 2, sy + i * 23);
        }
        if (revealed) {
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; api.setFont('800', 15);
          ctx.fillStyle = revealed.ok ? C_GOOD : C_BAD;
          ctx.fillText(revealed.ok ? (opts.okLabel || 'GIUSTO')
                                  : (revealed.good ? (opts.okLabel || 'GIUSTO') : (opts.badLabel || 'SBAGLIATO')),
                       api.W / 2, Math.max(90, cardY - 60));
        }
      },
      boxes: function (api) {
        layout(api.W, api.H);
        return cur ? [binRect(GOOD), binRect(GOOD === 'left' ? 'right' : 'left')] : [];
      },
      hud: function () { return { left: (opts.hudLabel || 'CARTE') + ' ' + (correct + wrong) + '/' + TARGET }; },
      result: function (api) {
        return {
          verdict: (correct + wrong >= TARGET) ? (opts.winVerdict || 'FATTO') : 'TEMPO SCADUTO',
          big: String(api.score),
          sub: opts.subLabel || ('PUNTI \u00b7 ' + correct + '/' + TARGET + ' GIUSTE')
        };
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
