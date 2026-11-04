(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add('js');

  // 1. Hero name: lines rise from a mask on load
  var name = document.querySelector('.name');
  if (name && !reduce) {
    var dash = name.querySelector('.dash');
    name.setAttribute('aria-label', 'Fiki Andriyan');
    name.innerHTML =
      '<span class="line" aria-hidden="true"><span>Fiki</span></span>' +
      '<span class="line" aria-hidden="true"><span>Andriyan ' + (dash ? '<span class="dash">&mdash;</span>' : '') + '</span></span>';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add('loaded'); });
    });
  } else {
    root.classList.add('loaded');
  }

  // 2. Reveal on scroll (staggered inside groups)
  var targets = document.querySelectorAll('.sec-title, .row, .about-text, .item, .cta-title, .cta-row, .foot');
  targets.forEach(function (el) { el.setAttribute('data-reveal', ''); });
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var siblings = e.target.parentElement.querySelectorAll(':scope > [data-reveal]');
        var i = Array.prototype.indexOf.call(siblings, e.target);
        e.target.style.transitionDelay = Math.min(i, 4) * 70 + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) { io.observe(el); });
  } else {
    targets.forEach(function (el) { el.classList.add('in'); });
  }

  if (reduce) return;

  // 3. Marquee speeds up with scroll and flips with direction
  var track = document.querySelector('.marquee-track');
  var lastY = window.scrollY, pos = 0, dir = -1, vel = 0;
  var marqueeOn = !!track;
  // 4. Hero fan: parallax on scroll, tilt toward the cursor
  var fan = document.querySelector('.fan');
  var imgs = fan ? fan.querySelectorAll('img') : [];
  var mx = 0, my = 0, cx = 0, cy = 0;
  var depth = [0.05, 0.1, 0.07];
  if (fine) {
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
  }

  // 5. Cursor bubble on work rows
  var bubble = null, bx = 0, by = 0, tx = 0, ty = 0, bubbleOn = false;
  if (fine) {
    bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.setAttribute('aria-hidden', 'true');
    bubble.textContent = 'Visit';
    document.body.appendChild(bubble);
    document.querySelectorAll('.row').forEach(function (r) {
      r.addEventListener('mouseenter', function () { bubbleOn = true; bubble.classList.add('on'); });
      r.addEventListener('mouseleave', function () { bubbleOn = false; bubble.classList.remove('on'); });
    });
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });
  }

  // 6. Magnetic buttons
  if (fine) {
    document.querySelectorAll('.btn').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.25;
        var y = (e.clientY - r.top - r.height / 2) * 0.35;
        b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
  }

  // 7. Live local time in the footer
  var foot = document.querySelectorAll('.foot span')[1];
  if (foot) {
    var tick = function () {
      try {
        var t = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' });
        foot.textContent = 'Indonesia (GMT+8) \u00b7 ' + t;
      } catch (err) {}
    };
    tick(); setInterval(tick, 30000);
  }

  var heroH = function () { return document.querySelector('.hero').offsetHeight; };
  function frame() {
    var y = window.scrollY;
    var dy = y - lastY; lastY = y;
    vel += (Math.min(Math.abs(dy), 40) - vel) * 0.1;
    if (dy !== 0) dir = dy > 0 ? -1 : 1;
    if (marqueeOn) {
      pos += dir * (0.6 + vel * 0.35);
      var half = track.scrollWidth / 2;
      if (pos <= -half) pos += half;
      if (pos > 0) pos -= half;
      track.style.transform = 'translate3d(' + pos + 'px,0,0)';
    }
    if (fan && y < heroH() + 200) {
      cx += (mx - cx) * 0.07; cy += (my - cy) * 0.07;
      imgs.forEach(function (img, i) {
        var base = i === 0 ? 'rotate(-5deg)' : i === 2 ? 'rotate(5deg)' : '';
        var py = -y * depth[i] * 1.6;
        img.style.transform = 'translate3d(' + (cx * 24 * (i + 1) / 2) + 'px,' + (py + cy * 14) + 'px,0) ' + base;
      });
    }
    if (bubble) {
      bx += (tx - bx) * 0.18; by += (ty - by) * 0.18;
      bubble.style.transform = 'translate3d(' + bx + 'px,' + by + 'px,0) translate(-50%,-50%) scale(' + (bubbleOn ? 1 : 0.2) + ')';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
