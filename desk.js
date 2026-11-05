/* Interactive 3D desk scene - one custom canvas renderer, no libraries.
   Tap the lamp for night mode, the monitor to flip through this site's pages,
   the keyboard to type on the screen; phone, notebook, coffee and plant react too. */
(function () {
  'use strict';
  var canvas = document.getElementById('desk-canvas');
  var hint = document.getElementById('desk-hint');
  if (!canvas || !canvas.getContext) return;
  var wrap = canvas.parentElement;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
      return this;
    };
  }

  var NAVY = '#12233a';
  var NAVY_DARK = '#0c1828';
  var NAVY_SOFT = '#1d3554';
  var BLUE = '#3f6fd8';
  var BLUE_SOFT = '#5b83ea';
  var CREAM = '#f3ead7';
  var CREAM_DARK = '#e3d3b4';
  var WOOD = '#e8d9bd';
  var WOOD_L = '#d9c4a0';
  var GREEN = '#6f9a7a';
  var GREEN_DARK = '#5b8367';
  var BROWN = '#6b4a2f';
  var SOIL = '#8a6b4a';
  var WARM = '#ffd68c';

  function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function shade(h, f) {
    var c = hexRgb(h);
    return 'rgb(' + Math.min(255, Math.round(c[0] * f)) + ',' + Math.min(255, Math.round(c[1] * f)) + ',' + Math.min(255, Math.round(c[2] * f)) + ')';
  }
  function mix(a, b, k) {
    var A = hexRgb(a), B = hexRgb(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * k) + ',' + Math.round(A[1] + (B[1] - A[1]) * k) + ',' + Math.round(A[2] + (B[2] - A[2]) * k) + ')';
  }

  var LIGHT = (function () {
    var l = [-0.45, -0.55, 0.75];
    var m = Math.hypot(l[0], l[1], l[2]);
    return [l[0] / m, l[1] / m, l[2] / m];
  })();

  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function boxFaces(w, d, h, color) {
    var x = w / 2, y = d / 2;
    var c = [[-x, -y, 0], [x, -y, 0], [x, y, 0], [-x, y, 0], [-x, -y, h], [x, -y, h], [x, y, h], [-x, y, h]];
    function q(a, b, c2, d2) { return [c[a], c[b], c[c2], c[d2]]; }
    return [
      { pts: q(0, 1, 2, 3), color: color },
      { pts: q(4, 7, 6, 5), color: color },
      { pts: q(0, 4, 5, 1), color: color },
      { pts: q(1, 5, 6, 2), color: color },
      { pts: q(2, 6, 7, 3), color: color },
      { pts: q(3, 7, 4, 0), color: color }
    ];
  }

  function cylFaces(r, h, color, seg) {
    seg = seg || 12;
    var faces = [];
    function ring(z) {
      var out = [];
      for (var i = 0; i < seg; i++) {
        var a = (i / seg) * Math.PI * 2;
        out.push([r * Math.cos(a), r * Math.sin(a), z]);
      }
      return out;
    }
    var bot = ring(0), top = ring(h);
    for (var i = 0; i < seg; i++) {
      var j = (i + 1) % seg;
      faces.push({ pts: [bot[i], bot[j], top[j], top[i]], color: color });
    }
    faces.push({ pts: top.slice(), color: color });
    faces.push({ pts: bot.slice().reverse(), color: color });
    return faces;
  }

  function discFace(r, color, seg, sx, sy) {
    seg = seg || 20; sx = sx || 1; sy = sy || 1;
    var pts = [];
    for (var i = 0; i < seg; i++) {
      var a = (i / seg) * Math.PI * 2;
      pts.push([r * Math.cos(a) * sx, r * Math.sin(a) * sy, 0]);
    }
    return { pts: pts, color: color };
  }

  function xform(faces, fn) {
    return faces.map(function (f) {
      return {
        pts: f.pts.map(fn),
        color: f.color,
        layer: f.layer,
        overlay: f.overlay ? { o: fn(f.overlay.o), u: fn(f.overlay.u), v: fn(f.overlay.v), draw: f.overlay.draw } : undefined
      };
    });
  }
  function translate(dx, dy, dz) { return function (p) { return [p[0] + dx, p[1] + dy, p[2] + dz]; }; }
  function rotZ(ang) {
    return function (p) {
      var c = Math.cos(ang), s = Math.sin(ang);
      return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
    };
  }
  function rotX(ang) {
    return function (p) {
      var c = Math.cos(ang), s = Math.sin(ang);
      return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
    };
  }
  function chain() {
    var fns = Array.prototype.slice.call(arguments);
    return function (p) { return fns.reduce(function (acc, fn) { return fn(acc); }, p); };
  }

  var DESK_Z = 128; // desk top surface height

  // ---------- screen pages: a miniature of this site ----------

  function screenText(c, str, x, y, scale, font, color, align) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.fillStyle = color;
    c.font = font;
    c.textAlign = align || 'left';
    c.textBaseline = 'middle';
    c.fillText(str, 0, 0);
    c.restore();
  }

  function screenBase(c, S) {
    var nb = S.night;
    var g = c.createRadialGradient(0.5, 0.35, 0.05, 0.5, 0.35, 0.9);
    g.addColorStop(0, 'rgba(91,131,234,' + (0.28 + 0.3 * nb) + ')');
    g.addColorStop(1, 'rgba(91,131,234,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 1, 1);
    c.fillStyle = CREAM;
    c.beginPath();
    c.arc(0.1, 0.12, 0.028, 0, Math.PI * 2);
    c.fill();
    for (var i = 0; i < 3; i++) {
      c.fillStyle = i === S.screenPage ? CREAM : 'rgba(243,234,215,0.35)';
      c.beginPath();
      c.arc(0.8 + i * 0.055, 0.11, 0.016, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawPageHero(c, t) {
    screenText(c, 'Fiki Andriyan', 0.09, 0.37, 0.0115, '800 7px Fraunces, Georgia, serif', CREAM);
    if (Math.floor(t * 1.6) % 2 === 0) {
      c.fillStyle = BLUE_SOFT;
      c.fillRect(0.68, 0.335, 0.018, 0.075);
    }
    screenText(c, 'Web Designer & Developer', 0.09, 0.5, 0.0075, '500 4px Inter, system-ui, sans-serif', 'rgba(243,234,215,0.65)');
    for (var i = 0; i < 3; i++) {
      var x = 0.09 + i * 0.295;
      c.fillStyle = NAVY_SOFT;
      c.fillRect(x, 0.64, 0.26, 0.22);
      c.strokeStyle = 'rgba(91,131,234,0.55)';
      c.lineWidth = 0.008;
      c.strokeRect(x, 0.64, 0.26, 0.22);
      c.fillStyle = 'rgba(63,111,216,0.55)';
      c.fillRect(x + 0.025, 0.665, 0.21, 0.09);
      c.fillStyle = 'rgba(243,234,215,0.5)';
      c.fillRect(x + 0.025, 0.795, 0.14, 0.025);
    }
  }

  var MINI_PROJECTS = ['Morgen', 'Gloskin', 'Bali Buggy', 'BDN'];

  function drawPageWork(c, t) {
    screenText(c, 'Selected Work', 0.09, 0.29, 0.0095, '800 6px Fraunces, Georgia, serif', 'rgba(243,234,215,0.9)');
    var hl = Math.floor(t * 0.8) % 4;
    for (var i = 0; i < 4; i++) {
      var x = 0.09 + (i % 2) * 0.43, y = 0.4 + Math.floor(i / 2) * 0.29;
      c.fillStyle = NAVY_SOFT;
      c.fillRect(x, y, 0.38, 0.24);
      c.strokeStyle = i === hl ? BLUE_SOFT : 'rgba(91,131,234,0.4)';
      c.lineWidth = i === hl ? 0.014 : 0.007;
      c.strokeRect(x, y, 0.38, 0.24);
      c.fillStyle = 'rgba(63,111,216,0.5)';
      c.fillRect(x + 0.03, y + 0.03, 0.32, 0.12);
      screenText(c, MINI_PROJECTS[i], x + 0.03, y + 0.2, 0.0065, '600 4px Inter, system-ui, sans-serif', 'rgba(243,234,215,0.85)');
    }
  }

  function drawPageContact(c, t) {
    c.fillStyle = 'rgba(243,234,215,0.9)';
    c.beginPath();
    c.arc(0.5, 0.3, 0.09, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = BLUE;
    c.beginPath();
    c.arc(0.5, 0.3, 0.058, 0, Math.PI * 2);
    c.fill();
    screenText(c, 'Fiki Andriyan', 0.5, 0.48, 0.008, '800 5px Fraunces, Georgia, serif', 'rgba(243,234,215,0.95)', 'center');
    screenText(c, 'fikiandriyanreal@gmail.com', 0.5, 0.575, 0.006, '500 4px Inter, system-ui, sans-serif', 'rgba(243,234,215,0.6)', 'center');
    var pulse = 0.5 + 0.5 * Math.sin(t * 3);
    c.fillStyle = BLUE;
    c.beginPath();
    c.roundRect(0.32, 0.68, 0.36, 0.13, 0.06);
    c.fill();
    c.strokeStyle = 'rgba(243,234,215,' + (0.35 + 0.4 * pulse) + ')';
    c.lineWidth = 0.008;
    c.stroke();
    screenText(c, 'WhatsApp', 0.5, 0.75, 0.0075, '600 5px Inter, system-ui, sans-serif', CREAM, 'center');
  }

  function drawTypedLine(c, t, S) {
    var dt = t - S.typeT0;
    if (dt < 0 || dt > 6) return;
    var msg = '> hello, world';
    var n = Math.min(msg.length, 1 + Math.floor(dt * 10));
    c.fillStyle = 'rgba(8,18,32,0.92)';
    c.fillRect(0.06, 0.15, 0.88, 0.1);
    c.save();
    c.translate(0.095, 0.2);
    c.scale(0.0115, 0.0115);
    c.fillStyle = '#aef7c1';
    c.font = '5px monospace';
    c.textBaseline = 'middle';
    c.fillText(msg.slice(0, n), 0, 0);
    if (n < msg.length && Math.floor(t * 3) % 2 === 0) {
      var w = c.measureText(msg.slice(0, n)).width;
      c.fillRect(w + 0.8, -2.2, 2.4, 4.4);
    }
    c.restore();
  }

  function drawScreen(S) {
    return function (c, t) {
      screenBase(c, S);
      var dt = t - S.screenT0;
      var slide = dt < 0.35 ? 1 - dt / 0.35 : 0;
      c.save();
      c.translate(slide, 0);
      c.globalAlpha = 1 - slide * 0.6;
      if (S.screenPage === 0) drawPageHero(c, t);
      else if (S.screenPage === 1) drawPageWork(c, t);
      else drawPageContact(c, t);
      c.restore();
      drawTypedLine(c, t, S);
    };
  }

  // ---------- other overlays ----------

  function drawKeys(S) {
    return function (c, t) {
      var nb = S.night;
      var typing = t - S.typeT0;
      var wave = typing >= 0 && typing < 1.6 ? typing * 9 : -10;
      for (var r = 0; r < 4; r++) {
        for (var col = 0; col < 10; col++) {
          var x = 0.05 + col * 0.092, y = 0.12 + r * 0.2;
          if (nb > 0.05) {
            var hue = (t * 50 + col * 26 + r * 42) % 360;
            c.fillStyle = 'hsla(' + hue + ',85%,' + (45 + 20 * nb) + '%,' + (0.35 + 0.65 * nb) + ')';
          } else {
            c.fillStyle = r === 3 && col > 5 ? 'rgba(243,234,215,0.55)' : 'rgba(243,234,215,0.92)';
          }
          var hit = Math.abs(col + r * 0.5 - wave);
          if (hit < 1.2) c.fillStyle = nb > 0.5 ? '#ffffff' : '#5b83ea';
          c.beginPath();
          c.rect(x, y, 0.068, 0.14);
          c.fill();
        }
      }
    };
  }

  function drawPhoneScreen(S) {
    return function (c, t) {
      var dt = t - S.phoneT0;
      var ping = dt >= 0 && dt < 2.4;
      c.fillStyle = ping ? '#3f6fd8' : 'rgba(63,111,216,0.5)';
      c.fillRect(0, 0, 1, 1);
      if (ping) {
        var a = dt < 0.3 ? dt / 0.3 : dt > 2 ? Math.max(0, 1 - (dt - 2) / 0.4) : 1;
        c.globalAlpha = a;
        c.fillStyle = 'rgba(243,234,215,0.96)';
        c.beginPath();
        c.roundRect(0.08, 0.06, 0.84, 0.3, 0.08);
        c.fill();
        c.fillStyle = '#12233a';
        c.beginPath();
        c.arc(0.24, 0.21, 0.075, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#3f6fd8';
        c.beginPath();
        c.arc(0.24, 0.21, 0.04, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(18,35,58,0.75)';
        c.fillRect(0.4, 0.13, 0.42, 0.06);
        c.fillStyle = 'rgba(18,35,58,0.4)';
        c.fillRect(0.4, 0.24, 0.32, 0.05);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = 'rgba(243,234,215,0.5)';
        c.fillRect(0.15, 0.08, 0.3, 0.05);
      }
    };
  }

  function drawNotes(S) {
    return function (c, t) {
      c.fillStyle = 'rgba(29,53,84,0.45)';
      for (var r = 0; r < 4; r++) {
        c.fillRect(0.12, 0.16 + r * 0.19, r === 3 ? 0.4 : 0.66, 0.06);
      }
      var dt = t - S.noteT0;
      if (dt >= 0 && dt < 0.8) {
        var k = dt / 0.8;
        var sz = Math.sin(k * Math.PI) * 0.45;
        c.fillStyle = 'rgba(227,211,180,0.95)';
        c.beginPath();
        c.moveTo(1, 1);
        c.lineTo(1 - sz, 1);
        c.lineTo(1, 1 - sz);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(29,53,84,0.5)';
        c.lineWidth = 0.015;
        c.stroke();
        c.fillStyle = 'rgba(91,131,234,0.8)';
        c.fillRect(0.12 + k * 0.5, 0.16 + 3 * 0.19, 0.16, 0.06);
      }
    };
  }

  function drawSteam(S) {
    return function (c, t) {
      var dt = t - S.steamT0;
      if (dt < 0 || dt > 3.2) return;
      var fade = dt > 2.2 ? Math.max(0, 1 - (dt - 2.2)) : 1;
      for (var i = 0; i < 3; i++) {
        var ph = (t * 0.9 + i * 0.33) % 1;
        var x = 0.3 + i * 0.2 + Math.sin(t * 3 + i * 2) * 0.05;
        c.strokeStyle = 'rgba(243,234,215,' + ((1 - ph) * 0.7 * fade) + ')';
        c.lineWidth = 0.045;
        c.beginPath();
        c.moveTo(x, 1 - ph * 0.15);
        c.quadraticCurveTo(x + 0.12 * Math.sin(t * 2 + i), 0.62 - ph * 0.3, x - 0.06, 0.35 - ph * 0.35);
        c.stroke();
      }
    };
  }

  function drawWarmGlow(S) {
    return function (c) {
      if (S.night < 0.03) return;
      var g = c.createRadialGradient(0.5, 0.5, 0.04, 0.5, 0.5, 0.55);
      g.addColorStop(0, 'rgba(255,214,140,' + (0.5 * S.night) + ')');
      g.addColorStop(1, 'rgba(255,214,140,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1, 1);
    };
  }

  function drawCoolGlow(S) {
    return function (c) {
      if (S.night < 0.03) return;
      var g = c.createRadialGradient(0.5, 0.5, 0.05, 0.5, 0.5, 0.6);
      g.addColorStop(0, 'rgba(80,130,255,' + (0.34 * S.night) + ')');
      g.addColorStop(1, 'rgba(80,130,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 1, 1);
    };
  }

  function leafFaces(len, wid, color) {
    var segs = 4;
    var faces = [];
    var px = 0, pz = 0, ang = 0.15;
    var pl = [-wid / 2, 0, 0], pr = [wid / 2, 0, 0];
    for (var i = 1; i <= segs; i++) {
      var step = len / segs;
      px += Math.sin(ang) * step;
      pz += Math.cos(ang) * step;
      ang += 0.32;
      var w = (wid / 2) * (1 - i / (segs + 0.6));
      var nl = [px - w, 0, pz];
      var nr = [px + w, 0, pz];
      faces.push({ pts: [pl, pr, nr, nl], color: i % 2 ? color : shade(color, 0.92) });
      pl = nl; pr = nr;
    }
    return faces;
  }

  // ---------- scene ----------

  function buildScene(t, S) {
    var F = [];
    function push(faces, fn, layer) {
      xform(faces, fn).forEach(function (f) { f.layer = layer || 0; F.push(f); });
    }
    var nb = S.night;
    function tint(c) { return mix(c, '#060d18', nb * 0.74); }
    function pulseLift(id) {
      var dz = 0;
      S.pulses.forEach(function (p) {
        if (p.id !== id) return;
        var dt = t - p.t0;
        if (dt >= 0 && dt < 0.55) dz += 9 * Math.exp(-3 * dt) * Math.sin(13 * dt);
      });
      return dz;
    }

    // Floor + soft shadow
    push([discFace(300, tint('#e7dcc4'), 24)], translate(250, 150, 0));
    push([discFace(210, nb > 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(18,35,58,0.16)', 20, 1.25, 0.95)], translate(250, 155, 0.6));

    // Desk legs + top
    var leg = boxFaces(14, 14, 110, tint(WOOD_L));
    [[97, 67], [97, 203], [389, 67], [389, 203]].forEach(function (xy) { push(leg, translate(xy[0], xy[1], 0)); });
    push(boxFaces(380, 220, 18, tint(WOOD)), translate(250, 150, 110));

    // Monitor + glow pool + screen
    push(boxFaces(80, 50, 10, tint(NAVY_SOFT)), translate(250, 75, DESK_Z), 1);
    push(boxFaces(20, 16, 44, tint(NAVY_DARK)), translate(250, 70, DESK_Z + 10), 1);
    if (nb > 0.03) {
      push([{ pts: discFace(85, 'rgba(0,0,0,0)', 18, 1.35, 0.8).pts, color: 'rgba(0,0,0,0)', overlay: { o: [-85 * 1.35, -85 * 0.8, 0.2], u: [85 * 1.35, -85 * 0.8, 0.2], v: [-85 * 1.35, 85 * 0.8, 0.2], draw: drawCoolGlow(S) } }], translate(250, 105, DESK_Z + 0.3), 2);
    }
    var screenW = 160, screenH = 120, screenD = 8;
    var screenFaces = boxFaces(screenW, screenD, screenH, tint(NAVY_DARK));
    screenFaces.splice(4, 1);
    screenFaces.push({
      pts: [[-screenW / 2, screenD / 2 + 0.3, 0.001], [screenW / 2, screenD / 2 + 0.3, 0.001], [screenW / 2, screenD / 2 + 0.3, screenH], [-screenW / 2, screenD / 2 + 0.3, screenH]],
      color: NAVY,
      overlay: { o: [screenW / 2 - 6, screenD / 2 + 0.4, screenH - 6], u: [-screenW / 2 + 6, screenD / 2 + 0.4, screenH - 6], v: [screenW / 2 - 6, screenD / 2 + 0.4, 6], draw: drawScreen(S) }
    });
    push(screenFaces, translate(250, 66, DESK_Z + 54 + 10), 1);

    // Keyboard (tappable: types onto the monitor)
    var kbW = 130, kbD = 50;
    var kbLift = pulseLift('keyboard');
    var kb = boxFaces(kbW, kbD, 7, tint(NAVY));
    kb.splice(1, 1);
    kb.push({
      pts: [[-kbW / 2, -kbD / 2, 7.3], [kbW / 2, -kbD / 2, 7.3], [kbW / 2, kbD / 2, 7.3], [-kbW / 2, kbD / 2, 7.3]],
      color: NAVY,
      overlay: { o: [-kbW / 2, -kbD / 2, 7.4], u: [kbW / 2, -kbD / 2, 7.4], v: [-kbW / 2, kbD / 2, 7.4], draw: drawKeys(S) }
    });
    push(kb, chain(rotZ(-0.03), translate(245, 175, DESK_Z + kbLift)), 1);

    // Notebook + pen (tappable: page flip)
    var nbLift = pulseLift('notebook');
    var nbW = 64, nbD = 48;
    var nbk = boxFaces(nbW, nbD, 5, tint(CREAM));
    nbk.splice(1, 1);
    nbk.push({
      pts: [[-nbW / 2, -nbD / 2, 5.3], [nbW / 2, -nbD / 2, 5.3], [nbW / 2, nbD / 2, 5.3], [-nbW / 2, nbD / 2, 5.3]],
      color: CREAM,
      overlay: { o: [-nbW / 2, -nbD / 2, 5.4], u: [nbW / 2, -nbD / 2, 5.4], v: [-nbW / 2, nbD / 2, 5.4], draw: drawNotes(S) }
    });
    push(nbk, chain(rotZ(0.05), translate(112, 184, DESK_Z + nbLift)), 1);
    push(boxFaces(34, 5, 4, tint(BLUE)), chain(rotZ(0.42), translate(96, 176, DESK_Z + 5 + nbLift)), 1);
    push(boxFaces(7, 5, 4, tint(NAVY)), chain(rotZ(0.42), translate(82, 169, DESK_Z + 5 + nbLift)), 1);

    // Phone (tappable: notification ping)
    var phLift = pulseLift('phone');
    push(boxFaces(26, 40, 9, tint(NAVY_DARK)), chain(rotZ(-0.12), translate(338, 185, DESK_Z + phLift)), 1);
    push([{ pts: boxFaces(21, 34, 1.6, NAVY)[1].pts, color: NAVY, overlay: { o: [-10.5, -17, 1.7], u: [10.5, -17, 1.7], v: [-10.5, 17, 1.7], draw: drawPhoneScreen(S) } }], chain(rotZ(-0.12), translate(338, 185, DESK_Z + 9 + phLift)), 1);

    // Mug + coffee + steam (tappable: fresh brew)
    var mgLift = pulseLift('coffee');
    push(cylFaces(14, 26, tint(BLUE), 14), translate(384, 198, DESK_Z + mgLift), 1);
    push([discFace(10.5, tint(BROWN), 14)], translate(384, 198, DESK_Z + 25 + mgLift), 1);
    push(boxFaces(5, 5, 14, tint(BLUE)), translate(401, 198, DESK_Z + 6 + mgLift), 1);
    push(boxFaces(6, 5, 5, tint(BLUE)), translate(399, 198, DESK_Z + 18 + mgLift), 1);
    push(boxFaces(6, 5, 5, tint(BLUE)), translate(399, 198, DESK_Z + 4 + mgLift), 1);
    push([{ pts: [[-9, 0, 0], [9, 0, 0], [9, 0, 46], [-9, 0, 46]], color: 'rgba(0,0,0,0)', overlay: { o: [-9, 0, 45.5], u: [9, 0, 45.5], v: [-9, 0, 0.5], draw: drawSteam(S) } }], translate(384, 198, DESK_Z + 26), 1);

    // Plant (tappable: happy wiggle)
    push(cylFaces(16, 22, tint(CREAM_DARK), 12), translate(110, 90, DESK_Z), 1);
    push([discFace(12.5, tint(SOIL), 12)], translate(110, 90, DESK_Z + 21), 1);
    var excite = (function () {
      var dt = t - S.plantT0;
      return dt >= 0 && dt < 1.4 ? 1 + 2.6 * Math.exp(-2.2 * dt) : 1;
    })();
    var sway = Math.sin(t * 1.4) * 0.06 * excite + Math.sin(t * 9) * 0.05 * (excite - 1);
    var leaves = [
      { a: 0.2, tilt: 0.55, len: 62, w: 20, c: GREEN },
      { a: 1.4, tilt: 0.4, len: 72, w: 22, c: GREEN_DARK },
      { a: 2.6, tilt: 0.62, len: 56, w: 18, c: GREEN },
      { a: 3.8, tilt: 0.35, len: 66, w: 20, c: GREEN_DARK },
      { a: 5.0, tilt: 0.58, len: 58, w: 18, c: GREEN },
      { a: 0.9, tilt: 0.15, len: 70, w: 20, c: GREEN }
    ];
    leaves.forEach(function (L, i) {
      var ph = sway * (1 + i * 0.25);
      push(leafFaces(L.len, L.w, tint(L.c)), chain(rotX(L.tilt + ph), rotZ(L.a), translate(110, 90, DESK_Z + 20)), 1);
    });

    // Lamp (tappable: night mode) on the back-right corner
    var lmLift = pulseLift('lamp');
    var lampBase = tint(NAVY_DARK);
    var lampGlowC = mix(NAVY_DARK, WARM, nb);
    push(cylFaces(15, 5, lampBase, 12), translate(392, 84, DESK_Z + lmLift), 1);
    push(cylFaces(3.2, 42, lampBase, 8), translate(392, 84, DESK_Z + 5 + lmLift), 1);
    push(cylFaces(2.6, 26, lampBase, 8), chain(rotX(-0.5), translate(392, 84, DESK_Z + 46 + lmLift)), 1);
    push(boxFaces(34, 26, 18, lampGlowC), chain(rotX(-0.28), translate(386, 98, DESK_Z + 62 + lmLift)), 1);
    if (nb > 0.03) {
      push([{ pts: discFace(110, 'rgba(0,0,0,0)', 18, 1.3, 0.85).pts, color: 'rgba(0,0,0,0)', overlay: { o: [-143, -93.5, 0.2], u: [143, -93.5, 0.2], v: [-143, 93.5, 0.2], draw: drawWarmGlow(S) } }], translate(372, 128, DESK_Z + 0.4), 2);
    }

    return F;
  }

  var ANCHORS = [
    { id: 'monitor', label: 'Monitor tapped - browsing the mini site. Tap again for the next page', p: [250, 62, 250] },
    { id: 'keyboard', label: 'Keyboard tapped - it types on the monitor', p: [245, 175, 140] },
    { id: 'notebook', label: 'Notebook tapped - flipping the page', p: [112, 184, 138] },
    { id: 'coffee', label: 'Coffee tapped - fresh steam', p: [384, 198, 160] },
    { id: 'plant', label: 'Plant tapped - happy wiggle', p: [110, 90, 200] },
    { id: 'phone', label: 'Phone tapped - new message ping', p: [338, 185, 142] },
    { id: 'lamp', label: 'Lamp tapped - night mode. Tap again for daylight', p: [386, 98, 205] }
  ];

  var FIT_POINTS = [
    [55, 35, 0], [445, 35, 0], [55, 265, 0], [445, 265, 0],
    [250, 66, 334], [170, 58, 326], [330, 58, 326], [170, 76, 326], [330, 76, 326],
    [110, 90, 230], [250, 150, 0], [386, 98, 220]
  ];
  var TARGET = [250, 150, 110];

  var S = {
    yaw: Math.PI / 2 - 0.25, pitch: 0.55, zoom: 1, lastInteract: 0,
    pointers: new Map(), pinch: 0, moved: 0,
    night: 0, nightTarget: 0, prevT: 0,
    screenPage: 0, screenT0: -10,
    typeT0: -10, phoneT0: -10, steamT0: -10, plantT0: -10, noteT0: -10,
    pulses: []
  };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cssW = 0, cssH = 0, dpr = 1;

  function resize() {
    var r = canvas.getBoundingClientRect();
    var w = r.width, h = r.height;
    if (!w || !h || (w === cssW && h === cssH)) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = w;
    cssH = h;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }

  function camera() {
    var f = [-Math.cos(S.pitch) * Math.cos(S.yaw), -Math.cos(S.pitch) * Math.sin(S.yaw), -Math.sin(S.pitch)];
    var u = [f[1], -f[0], 0];
    var um = Math.hypot(u[0], u[1]);
    u = [u[0] / um, u[1] / um, 0];
    return { f: f, u: u, v: cross(u, f) };
  }

  function fitRect(cam) {
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    FIT_POINTS.forEach(function (p) {
      var d = sub(p, TARGET);
      var sx = dot(d, cam.u), sy = -dot(d, cam.v);
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    });
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
  }

  function render(tms) {
    var t = tms / 1000;
    resize();
    if (!cssW) return;
    if (S.prevT === 0) S.prevT = t;
    var dt = Math.min(0.05, t - S.prevT);
    S.prevT = t;
    S.night += (S.nightTarget - S.night) * Math.min(1, dt * 5);
    if (Math.abs(S.nightTarget - S.night) < 0.004) S.night = S.nightTarget;
    S.pulses = S.pulses.filter(function (p) { return t - p.t0 < 0.6; });
    if (!reduced && t - S.lastInteract > 6 && S.pointers.size === 0) S.yaw += 0.00045;

    var cam = camera();
    var fr = fitRect(cam);
    var fit = Math.min(cssW / (fr.maxX - fr.minX), cssH / (fr.maxY - fr.minY)) * 0.88 * S.zoom;
    var cx = cssW / 2, cy = cssH / 2 - 8;
    var midX = (fr.minX + fr.maxX) / 2, midY = (fr.minY + fr.maxY) / 2;
    function projRaw(p) {
      var d = sub(p, TARGET);
      return [dot(d, cam.u), -dot(d, cam.v), dot(d, cam.f)];
    }
    function proj(p) {
      var s = projRaw(p);
      return [((s[0] - midX) * fit + cx) * dpr, ((s[1] - midY) * fit + cy) * dpr];
    }

    // scene background, day to night
    var bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, mix('#f3ead7', '#0a1524', S.night));
    bg.addColorStop(1, mix('#eadfc6', '#060d18', S.night));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    var faces = buildScene(reduced ? 0 : t, S);
    var shadeMul = 1 - 0.5 * S.night;
    var drawn = faces.map(function (fc) {
      var sp = fc.pts.map(proj);
      var depth = fc.pts.reduce(function (acc, p) { return acc + projRaw(p)[2]; }, 0) / fc.pts.length;
      var n = cross(sub(fc.pts[1], fc.pts[0]), sub(fc.pts[2], fc.pts[0]));
      var nm = Math.hypot(n[0], n[1], n[2]) || 1;
      var inten = (0.58 + 0.42 * Math.max(0, dot([n[0] / nm, n[1] / nm, n[2] / nm], LIGHT))) * shadeMul;
      return { sp: sp, depth: depth, fc: fc, inten: inten, layer: fc.layer || 0 };
    });
    drawn.sort(function (a, b) { return (a.layer - b.layer) || (b.depth - a.depth); });

    drawn.forEach(function (d) {
      var sp = d.sp, fc = d.fc;
      ctx.beginPath();
      sp.forEach(function (pt, i) { if (i === 0) ctx.moveTo(pt[0], pt[1]); else ctx.lineTo(pt[0], pt[1]); });
      ctx.closePath();
      ctx.fillStyle = fc.color.charAt(0) === '#' ? shade(fc.color, d.inten) : fc.color;
      ctx.fill();
      if (fc.overlay) {
        var o = proj(fc.overlay.o);
        var uu = proj(fc.overlay.u);
        var vv = proj(fc.overlay.v);
        var ex = [uu[0] - o[0], uu[1] - o[1]];
        var ey = [vv[0] - o[0], vv[1] - o[1]];
        if (ex[0] * ey[1] - ex[1] * ey[0] < 0) {
          var o2 = [uu[0], uu[1]];
          uu = [o[0], o[1]];
          o = o2;
          ex = [uu[0] - o[0], uu[1] - o[1]];
        }
        ctx.save();
        ctx.clip();
        ctx.setTransform(ex[0], ex[1], ey[0], ey[1], o[0], o[1]);
        fc.overlay.draw(ctx, t);
        ctx.restore();
      }
    });
  }

  // ---------- input ----------

  var HINT_DEFAULT = 'Drag to rotate - tap the lamp, monitor, keyboard or anything on the desk';
  var activeId = null;

  function setActive(id) {
    activeId = id;
    if (!hint) return;
    var found = null;
    ANCHORS.forEach(function (a) { if (a.id === id) found = a; });
    hint.textContent = found ? found.label : HINT_DEFAULT;
  }

  function onTapAction(id) {
    var t = performance.now() / 1000;
    S.pulses.push({ id: id, t0: t });
    if (id === 'monitor') { S.screenPage = (S.screenPage + 1) % 3; S.screenT0 = t; }
    else if (id === 'keyboard') { S.typeT0 = t; }
    else if (id === 'phone') { S.phoneT0 = t; }
    else if (id === 'coffee') { S.steamT0 = t; }
    else if (id === 'plant') { S.plantT0 = t; }
    else if (id === 'notebook') { S.noteT0 = t; }
    else if (id === 'lamp') { S.nightTarget = S.nightTarget > 0.5 ? 0 : 1; }
  }

  function pickAnchor(px, py) {
    var r = canvas.getBoundingClientRect();
    var cam = camera();
    var fr = fitRect(cam);
    var fit = Math.min(r.width / (fr.maxX - fr.minX), r.height / (fr.maxY - fr.minY)) * 0.88 * S.zoom;
    var midX = (fr.minX + fr.maxX) / 2, midY = (fr.minY + fr.maxY) / 2;
    var cx = r.width / 2, cy = r.height / 2 - 8;
    var best = null, bestD = 52;
    ANCHORS.forEach(function (a) {
      var d = sub(a.p, TARGET);
      var ax = (dot(d, cam.u) - midX) * fit + cx;
      var ay = (-dot(d, cam.v) - midY) * fit + cy;
      var dist = Math.hypot(ax - px, ay - py);
      if (dist < bestD) { bestD = dist; best = a.id; }
    });
    return best;
  }

  function onPointerDown(e) {
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* already released */ }
    S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    S.moved = 0;
    if (S.pointers.size === 2) {
      var ab = Array.from(S.pointers.values());
      S.pinch = Math.hypot(ab[0].x - ab[1].x, ab[0].y - ab[1].y);
    }
    S.lastInteract = performance.now() / 1000;
  }
  function onPointerMove(e) {
    var p = S.pointers.get(e.pointerId);
    if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y;
    S.moved += Math.abs(dx) + Math.abs(dy);
    p.x = e.clientX; p.y = e.clientY;
    S.lastInteract = performance.now() / 1000;
    if (S.pointers.size === 2) {
      var ab = Array.from(S.pointers.values());
      var d = Math.hypot(ab[0].x - ab[1].x, ab[0].y - ab[1].y);
      if (S.pinch > 0) S.zoom = Math.min(2.6, Math.max(0.5, S.zoom * (d / S.pinch)));
      S.pinch = d;
    } else {
      S.yaw += dx * 0.008;
      S.pitch = Math.min(1.25, Math.max(0.12, S.pitch + dy * 0.006));
    }
  }
  function onPointerUp(e) {
    S.pointers.delete(e.pointerId);
    S.pinch = 0;
    S.lastInteract = performance.now() / 1000;
    if (S.moved < 8) {
      var r = canvas.getBoundingClientRect();
      var id = pickAnchor(e.clientX - r.left, e.clientY - r.top);
      if (id) { onTapAction(id); setActive(id); }
      else setActive(null);
    }
  }
  function onWheel(e) {
    e.preventDefault();
    S.zoom = Math.min(2.6, Math.max(0.5, S.zoom * (e.deltaY > 0 ? 0.92 : 1.09)));
    S.lastInteract = performance.now() / 1000;
  }
  function onKey(e) {
    if (e.key === 'ArrowLeft') S.yaw -= 0.15;
    else if (e.key === 'ArrowRight') S.yaw += 0.15;
    else if (e.key === 'ArrowUp') S.pitch = Math.min(1.25, S.pitch + 0.1);
    else if (e.key === 'ArrowDown') S.pitch = Math.max(0.12, S.pitch - 0.1);
    else if (e.key === '+' || e.key === '=') S.zoom = Math.min(2.6, S.zoom * 1.1);
    else if (e.key === '-') S.zoom = Math.max(0.5, S.zoom * 0.9);
    else if (e.key === 'Enter' || e.key === ' ') {
      var order = ['monitor', 'keyboard', 'phone', 'notebook', 'coffee', 'plant', 'lamp'];
      var next = order[(order.indexOf(activeId || '') + 1) % order.length];
      onTapAction(next);
      setActive(next);
    }
    else return;
    S.lastInteract = performance.now() / 1000;
    e.preventDefault();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);

  // ---------- run only while the scene is on screen ----------

  var raf = 0, inView = false;
  S.lastInteract = performance.now() / 1000 + 2.5;

  function frame(tms) {
    render(tms);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || !inView || document.hidden) return;
    S.prevT = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) start(); else stop();
    }, { rootMargin: '80px' }).observe(canvas);
  } else {
    inView = true;
    start();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  resize();
})();
