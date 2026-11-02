/**
 * motore.js — il motore condiviso di play cuneo.
 *
 * Un gioco nuovo NON riscrive più questo file: passa solo una CONFIG e una MECCANICA.
 * Tutto quello che si sbagliava ogni volta (HUD che si sovrappone, testo doppio nella
 * schermata finale, CTA fuori dal pollice, shake che resta acceso) sta qui, una volta sola.
 *
 * Uso dentro un gioco:
 *   PlayCuneo.create({ cfg: CFG, mech: { init, update, draw, tap, boxes } })
 *
 * Contratto della meccanica:
 *   init(ctx)            prepara il round
 *   update(ctx, dt)      avanza la logica; chiama ctx.end(reason) per finire
 *   draw(ctx, t)         disegna il contenuto della partita (l'HUD lo disegna il motore)
 *   tap(ctx, x, y)       un tocco
 *   drag(ctx, x, y)      opzionale: trascinamento
 *   boxes(ctx)           aree toccabili in PLAY (per il collaudo)
 *   hud(ctx)             opzionale: {left, right, progress} per personalizzare l'HUD
 *   result(ctx)          testi della schermata finale (verdetto, numero, riga sotto)
 */
(function (global) {
  'use strict';

  // ─────────────────────────── configurazione di default ───────────────────────────
  var DEFAULTS = {
    roundSec: 20,
    ctaLabel: 'SCRIVIMI ORA',
    endMessage: '',
    palette: {
      bg1: '#0e2233', bg2: '#0a1520', bg3: '#0c1a26',
      accent1: '#2f7fa6', accent2: '#4fa3c7',
      ink: '#ffffff', soft: '#b6cfdd', warm: '#8fd0ea',
      good: '#9fe8c4', bad: '#f0b49a'
    },
    watermark: 'novanxion \u00b7 lo vuoi anche tu?'
  };

  function merge(a, b) {
    var out = {};
    Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k]) {
        out[k] = merge(a[k], b[k]);
      } else out[k] = b[k];
    });
    return out;
  }

  global.PlayCuneo = { create: create, merge: merge, DEFAULTS: DEFAULTS };

  function create(spec) {
    var CFG = merge(DEFAULTS, spec.cfg || {});
    var MECH = spec.mech;
    var P = CFG.palette;

    // ─────────────────────────── stato ───────────────────────────
    var canvas = document.getElementById('c');
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, DPR = 1;
    var STATE = 'INTRO';
    var score = 0, progress = 0, progressMax = CFG.roundSec;
    var timeLeft = CFG.roundSec, roundT = 0, lastT = 0;
    var shake = 0, flashT = 0, flashColor = 'rgba(255,80,80,';
    var endReason = '', ended = false;
    var startBtn = {}, ctaBtn = {}, replayBtn = {}, landingBtn = {}, markBtn = {};

    // ─────────────────────────── utilità ───────────────────────────
    function rand(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
    function rr(x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2); ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    function setFont(weight, size) {
      ctx.font = weight + ' ' + Math.round(size) + 'px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    }
    var FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';
    function fitSize(txt, weight, maxSize, maxW) {
      var s = maxSize;
      while (s > 10) { setFont(weight, s); if (ctx.measureText(txt).width <= maxW) return s; s -= 1; }
      return 10;
    }
    function wrapLines(txt, maxW) {
      var words = String(txt).split(' '), lines = [], line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; }
        else line = test;
      }
      if (line) lines.push(line);
      return lines;
    }
    function resize() {
      DPR = Math.min(2, global.devicePixelRatio || 1);
      W = global.innerWidth; H = global.innerHeight;
      canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (MECH.resize) MECH.resize(api);
    }
    global.addEventListener('resize', resize);
    resize();

    // ─────────────────────────── uscita / CTA ───────────────────────────
    function openUrl(url) {
      try { if (global.mraid && typeof global.mraid.open === 'function') { global.mraid.open(url); return; } } catch (e) {}
      try { if (typeof global.clickTag !== 'undefined' && global.clickTag) { global.open(global.clickTag, '_blank'); return; } } catch (e) {}
      var ok = null; try { ok = global.open(url, '_blank'); } catch (e) {}
      if (ok) return;
      var fb = document.getElementById('urlfb');
      fb.textContent = 'Destinazione CTA: ' + url; fb.style.display = 'block';
    }

    // ─────────────────────────── audio sintetico ───────────────────────────
    var AC = null;
    function audio() {
      try {
        if (!AC) AC = new (global.AudioContext || global.webkitAudioContext)();
        if (AC.state === 'suspended') AC.resume();
        return AC;
      } catch (e) { return null; }
    }
    function beep(freq, dur, type, vol, when) {
      var ac = audio(); if (!ac) return;
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (when || 0);
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.03);
    }
    function sfx(n) {
      if (n === 'hit') { beep(700, 0.09, 'triangle', 0.15, 0); beep(940, 0.13, 'triangle', 0.12, 0.06); }
      else if (n === 'star') { beep(880, 0.08, 'sine', 0.14, 0); beep(1180, 0.12, 'sine', 0.13, 0.06); }
      else if (n === 'miss') { beep(180, 0.16, 'sawtooth', 0.10, 0); }
      else if (n === 'tick') { beep(520, 0.05, 'square', 0.05, 0); }
      else if (n === 'win') { beep(659, 0.10, 'triangle', 0.13, 0); beep(988, 0.18, 'triangle', 0.13, 0.09); }
      else if (n === 'end') { beep(523, 0.12, 'triangle', 0.14, 0); beep(784, 0.20, 'triangle', 0.14, 0.12); beep(1046, 0.26, 'triangle', 0.14, 0.32); }
    }

    // ─────────────────────────── flusso ───────────────────────────
    function startRound() {
      STATE = 'PLAY';
      score = 0; progress = 0; timeLeft = CFG.roundSec; roundT = 0;
      shake = 0; flashT = 0; ended = false; endReason = '';
      MECH.init(api);
      sfx('tick');
    }
    function endRound(reason) {
      if (STATE !== 'PLAY') return;
      STATE = 'END'; endReason = reason || 'time';
      shake = 0; flashT = 0;      // lo shake muore sempre qui, in ogni gioco
      ended = true;
      sfx('end');
    }

    // oggetto passato alla meccanica: la meccanica non tocca lo stato del motore
    var api = {
      get ctx() { return ctx; },
      get W() { return W; }, get H() { return H; }, get state() { return STATE; },
      get timeLeft() { return timeLeft; }, get roundT() { return roundT; },
      get score() { return score; },
      setScore: function (v) { score = Math.max(0, Math.round(v)); },
      addScore: function (v) { score = Math.max(0, score + v); },
      get progress() { return progress; },
      setProgress: function (v, max) { progress = v; if (max) progressMax = max; },
      end: endRound,
      shake: function (v) { shake = v; },
      flash: function (color, dur) { flashColor = color; flashT = dur || 0.2; },
      sfx: sfx, audio: audio,
      rand: rand, clamp: clamp, rr: rr, setFont: setFont, fitSize: fitSize,
      wrapLines: wrapLines, FONT: FONT, palette: P,
      drawBg: drawBackground, chip: chip, button: bigButton
    };

    // ─────────────────────────── input ───────────────────────────
    var dragging = false;
    function hit(b, x, y) { return b && b.w > 0 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
    function onDown(x, y) {
      audio();
      if (STATE === 'INTRO') { startRound(); return; }
      if (STATE === 'END') {
        if (hit(replayBtn, x, y)) { startRound(); return; }
        if (CFG.landingUrl && hit(landingBtn, x, y)) { openUrl(CFG.landingUrl); return; }
        if (hit(markBtn, x, y)) { openUrl(CFG.destUrl); return; }
        openUrl(CFG.destUrl); return;
      }
      dragging = true;
      if (MECH.tap) MECH.tap(api, x, y);
    }
    canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); onDown(e.clientX, e.clientY); });
    canvas.addEventListener('pointermove', function (e) {
      e.preventDefault();
      if (dragging && STATE === 'PLAY' && MECH.drag) MECH.drag(api, e.clientX, e.clientY);
    });
    global.addEventListener('pointerup', function () { dragging = false; });
    global.addEventListener('pointercancel', function () { dragging = false; });
    canvas.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

    // ─────────────────────────── disegno: componenti condivisi ───────────────────────────
    function drawBackground(t) {
      var g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, P.bg1); g.addColorStop(0.55, P.bg2); g.addColorStop(1, P.bg3);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var gg = ctx.createRadialGradient(W / 2, H * 1.12, 10, W / 2, H * 1.12, H * 0.72);
      gg.addColorStop(0, 'rgba(80,160,210,0.16)'); gg.addColorStop(1, 'rgba(80,160,210,0)');
      ctx.fillStyle = gg; ctx.fillRect(0, 0, W, H);
    }
    function chip(txt, cx, y) {
      setFont('700', 12.5);
      var w = ctx.measureText(txt).width + 26;
      ctx.fillStyle = 'rgba(120,190,230,0.14)'; rr(cx - w / 2, y - 14, w, 27, 13); ctx.fill();
      ctx.strokeStyle = 'rgba(120,190,230,0.65)'; ctx.lineWidth = 1.5; rr(cx - w / 2, y - 14, w, 27, 13); ctx.stroke();
      ctx.fillStyle = P.soft; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, cx, y + 1);
    }
    function bigButton(bx, by, bw, bh, label, c1, c2, pulse) {
      ctx.save();
      var fs = fitSize(label, '800', 19, bw - 36);
      if (pulse) {
        var s = 1 + Math.sin(pulse) * 0.03;
        ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(s, s); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
      }
      var g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
      g.addColorStop(0, c1 || P.accent1); g.addColorStop(1, c2 || P.accent2);
      ctx.fillStyle = g; rr(bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = '#fff'; setFont('800', fs);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, bx + bw / 2, by + bh / 2 + 1);
      ctx.restore();
    }

    // ─────────────────────────── INTRO (una sola, per tutti) ───────────────────────────
    function drawIntro(t) {
      drawBackground(t);
      var cx = W / 2;
      if (CFG.brand) chip(CFG.brand, cx, H * 0.12);
      var y = H * 0.24;
      if (MECH.drawIcon) { y = MECH.drawIcon(api, cx, H * 0.30); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      setFont('800', fitSize(CFG.title, '800', Math.min(40, W * 0.093), W * 0.86));
      ctx.fillText(CFG.title, cx, y);
      if (CFG.tagline) {
        setFont('500', 15); ctx.fillStyle = P.soft;
        ctx.fillText(CFG.tagline, cx, y + H * 0.045);
      }
      if (CFG.howto) {
        setFont('700', 13.5); ctx.fillStyle = P.warm;
        ctx.fillText(CFG.howto, cx, y + H * 0.10);
      }
      if (MECH.drawIntro) MECH.drawIntro(api, t);
      var bw = Math.min(W * 0.72, 320), bh = 58, bx = cx - bw / 2, by = H * 0.72;
      startBtn = { x: bx, y: by, w: bw, h: bh };
      bigButton(bx, by, bw, bh, 'TOCCA PER GIOCARE', P.accent1, P.accent2, t * 0.006);
      var foot = CFG.footer !== undefined ? CFG.footer
               : (CFG.brand ? 'play cuneo \u00b7 demo di ' + CFG.brand : 'play cuneo');
      if (foot) {
        setFont('500', 11.5); ctx.fillStyle = 'rgba(180,215,235,0.5)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(foot, cx, H - 20);
      }
    }

    // ─────────────────────────── PLAY (HUD fisso, mai sovrapposto) ───────────────────────────
    function drawHUD() {
      var hud = (MECH.hud && MECH.hud(api)) || {};
      var left = hud.left !== undefined ? hud.left : 'CASE ' + progress + '/' + progressMax;
      var right = hud.right !== undefined ? hud.right : Math.ceil(timeLeft) + 's';
      var frac = hud.progress !== undefined ? hud.progress : clamp(timeLeft / CFG.roundSec, 0, 1);

      /* se c'è un logo in alto a sinistra, l'HUD scende per non coprirlo */
      var dy = CFG.logo ? 46 : 0;

      // barra: sempre nella fascia centrale, tra i due testi
      var bx = 140, bw = W - 140 - 116, by = 22 + dy;
      if (bw > 40) {
        ctx.fillStyle = 'rgba(255,255,255,0.14)'; rr(bx, by, bw, 8, 4); ctx.fill();
        ctx.fillStyle = timeLeft > 5 ? P.good : P.bad;
        rr(bx, by, bw * clamp(frac, 0, 1), 8, 4); ctx.fill();
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; setFont('800', 22);
      ctx.fillText(String(score), 18, 32 + dy);
      ctx.fillStyle = P.warm; setFont('700', 12);
      ctx.fillText(left, 18, 54 + dy);
      ctx.textAlign = 'right';
      ctx.fillStyle = timeLeft > 5 ? P.soft : P.bad; setFont('800', 22);
      ctx.fillText(right, W - 18, 32 + dy);
    }

    function drawPlay(t) {
      drawBackground(t);
      MECH.draw(api, t);
      drawHUD();
      if (flashT > 0) {
        ctx.fillStyle = flashColor + clamp(flashT * 2, 0, 0.5) + ')';
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ─────────────────────────── END (la schermata finale, una sola per tutti) ───────────────────────────
    function drawEnd(t) {
      drawBackground(t);
      var cx = W / 2;
      var res = (MECH.result && MECH.result(api)) || {};
      var verdict = res.verdict || (endReason === 'time' ? 'TEMPO SCADUTO' : 'FATTO');
      var big = res.big !== undefined ? String(res.big) : String(score);
      var sub = res.sub || ('PUNTI \u00b7 ' + progress + '/' + progressMax);

      var pw = Math.min(W * 0.88, 400);
      var ph = Math.min(520, H * 0.76);
      var px = cx - pw / 2, py = (H - ph) / 2;
      ctx.fillStyle = 'rgba(8,18,28,0.94)'; rr(px, py, pw, ph, 24); ctx.fill();
      ctx.strokeStyle = 'rgba(79,163,199,0.55)'; ctx.lineWidth = 2; rr(px, py, pw, ph, 24); ctx.stroke();

      var iw = pw - 44, padB = 22;
      var hasLanding = !!CFG.landingUrl;
      var bh = 58;
      var cby = py + ph - padB - bh;                       // CTA incollato in basso: pollice
      var rbw = Math.min(iw * 0.62, 176), rbh = 40;
      var rby = cby - 12 - rbh;
      var landingY = hasLanding ? (rby - 26) : (rby - 8);
      var brandY = landingY - 20;
      var msgBottom = brandY - 18;

      var y = py + 30;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      setFont('800', 14.5); ctx.fillStyle = P.warm;
      ctx.fillText(verdict, cx, y + 16);
      y += 42;
      setFont('800', fitSize(big, '800', 54, iw)); ctx.fillStyle = '#fff';
      ctx.fillText(big, cx, y + 40);
      y += 60;
      setFont('600', 12); ctx.fillStyle = P.soft;
      ctx.fillText(sub, cx, y + 12);
      y += 36;

      // frase: font impostata PRIMA di misurare (era il bug del testo sovrapposto)
      ctx.fillStyle = '#eaf6ff';
      var msgSize = Math.min(19, Math.max(15, W * 0.045));
      var lh = Math.round(msgSize * 1.38);
      setFont('600', msgSize);
      var lines = wrapLines(CFG.endMessage, iw - 10);
      var blockH = (lines.length - 1) * lh;
      var availH = msgBottom - y;
      var startY = y + Math.max(0, (availH - blockH) / 2) + msgSize;
      if (startY + blockH > msgBottom) startY = msgBottom - blockH;
      for (var i = 0; i < lines.length; i++) ctx.fillText(lines[i], cx, startY + i * lh);

      var bw = iw, bx = cx - bw / 2;
      ctaBtn = { x: bx, y: cby, w: bw, h: bh };
      bigButton(bx, cby, bw, bh, CFG.ctaLabel, P.accent1, P.accent2, t * 0.006);

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; rr(cx - rbw / 2, rby, rbw, rbh, 20); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.5; rr(cx - rbw / 2, rby, rbw, rbh, 20); ctx.stroke();
      ctx.fillStyle = '#eaf6ff'; setFont('700', 13.5);
      ctx.fillText('\u21bb  RIGIOCA', cx, rby + rbh / 2 + 1);
      replayBtn = { x: cx - rbw / 2, y: rby, w: rbw, h: rbh };

      if (hasLanding) {
        setFont('600', 11.5);
        var ltxt = 'scopri play cuneo \u2192';
        var lw = Math.min(iw, ctx.measureText(ltxt).width + 20);
        landingBtn = { x: cx - lw / 2, y: landingY - 11, w: lw, h: 22 };
        ctx.fillStyle = 'rgba(143,208,234,0.8)';
        ctx.fillText(ltxt, cx, landingY);
      } else { landingBtn = { x: 0, y: 0, w: 0, h: 0 }; }

      var brandLine = [CFG.brand, CFG.tagline].filter(Boolean).join(' \u00b7 ');
      if (brandLine) {
        setFont('600', 11.5);
        if (ctx.measureText(brandLine).width > iw) brandLine = CFG.brand || CFG.tagline;
        ctx.fillStyle = '#7f9aab'; ctx.fillText(brandLine, cx, brandY);
      }

      if (CFG.watermark) {
        setFont('600', 10);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        var mw = Math.min(W - 16, ctx.measureText(CFG.watermark).width + 12);
        markBtn = { x: Math.max(8, W - mw - 8), y: H - 22, w: mw, h: 20 };
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillText(CFG.watermark, W - 8, H - 12);
      } else { markBtn = { x: 0, y: 0, w: 0, h: 0 }; }
    }

    // ─────────────────────────── loop ───────────────────────────
    function update(dt) {
      if (STATE !== 'PLAY') return;
      roundT += dt; timeLeft = CFG.roundSec - roundT;
      if (timeLeft <= 0) { timeLeft = 0; endRound('time'); return; }
      if (MECH.update) MECH.update(api, dt);
    }
    function frame(t) {
      var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
      lastT = t;
      try {
        update(dt);
        if (shake > 0) shake = Math.max(0, shake - dt * 40);      // decade in OGNI stato
        if (flashT > 0) flashT = Math.max(0, flashT - dt);
        ctx.save();
        if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
        if (STATE === 'INTRO') drawIntro(t);
        else if (STATE === 'PLAY') drawPlay(t);
        else drawEnd(t);
        /* logo del cliente: sempre visibile, in OGNI stato, in alto a sinistra */
        if (CFG.logo) {
          try { CFG.logo(api); } catch (e) { /* un logo rotto non deve fermare il gioco */ }
        }
        ctx.restore();
      } catch (err) {
        ctx.fillStyle = P.bg2; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Ricarica la pagina', W / 2, H / 2);
        if (global.console) global.console.error(err);
      }
      global.requestAnimationFrame(frame);
    }
    global.requestAnimationFrame(frame);

    // ─────────────────────────── contratto di collaudo ───────────────────────────
    global.__PLAYABLE__ = function () {
      var boxes;
      if (STATE === 'PLAY') {
        boxes = (MECH.boxes && MECH.boxes(api)) || [];
      } else if (STATE === 'END') {
        boxes = [ctaBtn, replayBtn];
        if (CFG.landingUrl) boxes.push(landingBtn);
      } else {
        boxes = [startBtn];
      }
      return {
        state: STATE, score: score, shake: shake,
        progress: progress, boxes: boxes.filter(function (b) { return b && b.w > 0 && b.h > 0; })
      };
    };

    return api;
  }
})(typeof window !== 'undefined' ? window : this);
