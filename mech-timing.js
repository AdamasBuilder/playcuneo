/**
 * mech-timing.js — modulo "barra di precisione" per il motore play cuneo.
 * Un indice scorre su una barra: si ferma nella zona buona. La zona si restringe.
 * Adatto a: parcheggio, frenata, mira, "centra l'obiettivo".
 *
 * opts.rounds      numero di colpi (default 3)
 * opts.period      secondi per una passata (default 0.95)
 * opts.tolerance   ampiezza iniziale della zona buona, in frazione (default 0.14)
 * opts.shrink      quanto si stringe a ogni colpo (default 0.02)
 * opts.labels      testi sotto la barra (opzionale)
 * opts.drawStage   function(ctx, api, t, x0, x1) — disegno sopra la barra
 */
(function (global) {
  'use strict';
  global.PlayCuneoMechanics = global.PlayCuneoMechanics || {};

  global.PlayCuneoMechanics.timing = function (opts) {
    opts = opts || {};
    var ROUNDS = opts.rounds || 3;
    var PERIOD = opts.period || 0.95;
    var TOL0 = opts.tolerance || 0.14;
    var SHRINK = opts.shrink || 0.02;

    var hitIndex = 0, pos = 0.5, dir = 1, tol = TOL0, hits = 0, misses = 0;
    var reveal = null, bar = { x0: 0, x1: 0, y: 0, h: 26 };

    function layout(api) {
      var pad = Math.max(16, api.W * 0.08);
      bar.x0 = pad; bar.x1 = api.W - pad;
      bar.y = api.H * 0.66;
      bar.h = Math.max(22, Math.min(30, api.H * 0.032));
    }

    return {
      init: function () {
        hitIndex = 0; pos = 0.5; dir = 1; tol = TOL0; hits = 0; misses = 0; reveal = null;
      },
      update: function (api, dt) {
        if (reveal) { reveal.t -= dt; if (reveal.t <= 0) reveal = null; return; }
        var speed = 1 / PERIOD;             // frazioni al secondo
        pos += dir * speed * dt;
        if (pos >= 1) { pos = 1; dir = -1; }
        if (pos <= 0) { pos = 0; dir = 1; }
      },
      tap: function (api) {
        if (reveal) return;
        var half = tol / 2;
        var ok = Math.abs(pos - 0.5) <= half;
        if (ok) { hits++; api.addScore(100); api.sfx('hit'); }
        else { misses++; api.shake(7); api.sfx('miss'); }
        api.setProgress(hitIndex + 1, ROUNDS);
        reveal = { ok: ok, t: 0.55 };
        setTimeout(function () {
          if (api.state !== 'PLAY') return;
          reveal = null;
          hitIndex++;
          if (hitIndex >= ROUNDS) { api.end('done'); return; }
          tol = Math.max(0.05, TOL0 - SHRINK * hitIndex);
          pos = 0.5; dir = 1;
        }, 560);
      },
      draw: function (api, t) {
        layout(api);
        var ctx = api.ctx, P = api.palette;
        var w = bar.x1 - bar.x0;

        /* fascia esterna (l'asfalto) */
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        api.rr(bar.x0, bar.y, w, bar.h, bar.h / 2); ctx.fill();

        /* zona buona: si restringe a ogni colpo */
        var gw = w * tol;
        var gx = bar.x0 + w / 2 - gw / 2;
        ctx.fillStyle = reveal ? (reveal.ok ? 'rgba(127,227,176,0.85)' : 'rgba(224,138,106,0.85)')
                               : 'rgba(127,227,176,0.42)';
        api.rr(gx, bar.y, gw, bar.h, bar.h / 2); ctx.fill();
        ctx.strokeStyle = P.good; ctx.lineWidth = 2;
        api.rr(gx, bar.y, gw, bar.h, bar.h / 2); ctx.stroke();

        /* indice */
        var px = bar.x0 + w * pos;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(px, bar.y + bar.h / 2, bar.h * 0.55, 0, 7); ctx.fill();
        ctx.fillStyle = P.accent1;
        ctx.beginPath(); ctx.arc(px, bar.y + bar.h / 2, bar.h * 0.34, 0, 7); ctx.fill();

        /* etichette */
        api.setFont('800', 13);
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = P.bad;
        ctx.fillText(opts.labelLeft || 'GRAFFIO', bar.x0 + 34, bar.y + bar.h + 22);
        ctx.fillStyle = P.good;
        ctx.fillText(opts.labelRight || 'PARCHEGGIO', bar.x1 - 46, bar.y + bar.h + 22);
        ctx.fillStyle = P.soft;
        api.setFont('600', 12);
        ctx.fillText(opts.hint || 'Tocca quando sei al centro', api.W / 2, bar.y + bar.h + 44);
      },
      boxes: function (api) {
        layout(api);
        return [{ x: bar.x0, y: bar.y - 40, w: bar.x1 - bar.x0, h: bar.h + 80 }];
      },
      hud: function () { return { left: 'MANOVRE ' + hitIndex + '/' + ROUNDS }; },
      /* stato della barra, per chi vuole disegnare sopra (es. l'auto che si infila) */
      state: function () { return { pos: pos, dir: dir, tol: tol, hitIndex: hitIndex, rounds: ROUNDS, reveal: reveal }; },
      result: function (api) {
        return {
          verdict: hitIndex >= ROUNDS ? (opts.winVerdict || 'PARCHEGGIO PERFETTO') : 'TEMPO SCADUTO',
          big: String(api.score),
          sub: opts.subLabel || ('PUNTI \u00b7 ' + hits + '/' + ROUNDS + ' MANOVRE PULITE')
        };
      }
    };
  };
})(typeof window !== 'undefined' ? window : this);
