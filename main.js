(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  root.classList.add('js');

  // 1. Hero name: lines rise from a mask on load
  var name = document.querySelector('.name');
  if (name && !reduce) {
    var dots = name.querySelector('.dots');
    name.setAttribute('aria-label', 'Fiki Andriyan');
    name.innerHTML =
      '<span class="line" aria-hidden="true"><span>Fiki</span></span>' +
      '<span class="line" aria-hidden="true"><span>Andriyan' + (dots ? '<span class="dots"><span></span><span></span><span></span></span>' : '') + '</span></span>';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add('loaded'); });
    });
  } else {
    root.classList.add('loaded');
  }

  // 2. Reveal on scroll (staggered inside groups)
  var targets = document.querySelectorAll('.sec-title, .sec-lede, .case, .row, .about-text, .item, .svc-also, .svc-foot, .tour-list, .tour-seen, .step, .cta-title, .cta-row, .cta-loc, .foot');
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

  // Section transitions: a rule draws in at the top of each section
  var secs = document.querySelectorAll('#work, #what-i-do, #about, #services, #process');
  secs.forEach(function (s) { s.classList.add('sline'); });
  if ('IntersectionObserver' in window && !reduce) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); so.unobserve(e.target); } });
    }, { threshold: 0, rootMargin: '0px 0px -20% 0px' });
    secs.forEach(function (s) { so.observe(s); });
  } else {
    secs.forEach(function (s) { s.classList.add('in'); });
  }
  // Safety: anything still hidden is shown once the reader reaches the bottom
  window.addEventListener('scroll', function () {
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 6) {
      document.querySelectorAll('[data-reveal]:not(.in)').forEach(function (el) { el.classList.add('in'); });
    }
  }, { passive: true });



  // Smooth wheel scrolling (eased glide), desktop pointer only; native scroll position is kept
  if (fine && !reduce) {
    var targetY = window.scrollY, smoothing = false;
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || document.body.classList.contains('menu-open')) return;
      e.preventDefault();
      var d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      targetY = Math.min(Math.max(0, targetY + d), document.documentElement.scrollHeight - window.innerHeight);
      if (!smoothing) { smoothing = true; requestAnimationFrame(smoothStep); }
    }, { passive: false });
    var smoothStep = function () {
      var cur = window.scrollY, d = targetY - cur;
      if (Math.abs(d) < 0.6) { smoothing = false; return; }
      window.scrollTo({ top: cur + d * 0.11, behavior: 'instant' });
      requestAnimationFrame(smoothStep);
    };
    window.addEventListener('scroll', function () { if (!smoothing) targetY = window.scrollY; }, { passive: true });
    window.addEventListener('pointerdown', function () { smoothing = false; targetY = window.scrollY; }, { passive: true });
  }

  // 2b. Sticky hamburger: a round menu button appears once the hero nav scrolls away
  var menuBtn = document.querySelector('.menu-btn');
  var menuEl = document.getElementById('site-menu');
  if (menuBtn && menuEl) {
    var menuOpen = false;
    var lastY = window.scrollY;
    var mobileMq = window.matchMedia('(max-width: 640px)');
    var onScrollMenu = function () {
      var y = window.scrollY;
      document.body.classList.toggle('scrolled', y > 100);
      // Mobile only: tuck the button away while scrolling down (reading),
      // bring it back on scroll up or near the top
      if (mobileMq.matches && !menuOpen) {
        if (y > 140 && y > lastY + 4) document.body.classList.add('menu-hidden');
        else if (y < lastY - 4 || y <= 140) document.body.classList.remove('menu-hidden');
      }
      lastY = y;
    };
    window.addEventListener('scroll', onScrollMenu, { passive: true });
    onScrollMenu();
    var setMenu = function (open) {
      menuOpen = open;
      if (open) document.body.classList.remove('menu-hidden');
      document.body.classList.toggle('menu-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menuEl.setAttribute('aria-hidden', String(!open));
    };
    menuBtn.addEventListener('click', function () { setMenu(!menuOpen); });
    menuEl.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuOpen) setMenu(false);
    });
    // Magnetic pull on the button's inner mark (fine pointer only)
    if (fine && !reduce) {
      var inner = menuBtn.querySelector('.menu-btn-inner');
      menuBtn.addEventListener('mousemove', function (e) {
        var r = menuBtn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.3;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        inner.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      });
      menuBtn.addEventListener('mouseleave', function () { inner.style.transform = ''; });
    }
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
  var peek = null, px = 0, py = 0, peekOn = false, bubble = null, bx = 0, by = 0, tx = 0, ty = 0, bubbleOn = false;
  if (fine) {
    bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.setAttribute('aria-hidden', 'true');
    bubble.textContent = 'Visit';
    document.body.appendChild(bubble);
    document.querySelectorAll('.case-img').forEach(function (r) {
      r.addEventListener('mouseenter', function () { bubbleOn = true; bubble.classList.add('on'); });
      r.addEventListener('mouseleave', function () { bubbleOn = false; bubble.classList.remove('on'); });
    });
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });

    // Project list: a preview follows the cursor, with a View circle
    var rowEls = document.querySelectorAll('.row');
    if (rowEls.length) {
      peek = document.createElement('div');
      peek.className = 'peek';
      peek.setAttribute('aria-hidden', 'true');
      rowEls.forEach(function (r) {
        var t = r.querySelector('.thumb');
        if (!t) return;
        var im = document.createElement('img');
        im.src = t.currentSrc || t.src; im.alt = '';
        peek.appendChild(im);
        r._peekImg = im;
      });
      var view = document.createElement('span');
      view.className = 'peek-view'; view.textContent = 'View';
      peek.appendChild(view);
      document.body.appendChild(peek);
      root.classList.add('peek-on');
      rowEls.forEach(function (r) {
        r.addEventListener('mouseenter', function () {
          peek.querySelectorAll('img').forEach(function (i) { i.classList.remove('active'); });
          if (r._peekImg) r._peekImg.classList.add('active');
          peekOn = true; peek.classList.add('on');
        });
        r.addEventListener('mouseleave', function () { peekOn = false; peek.classList.remove('on'); });
      });
    }
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

  var heroInner = document.querySelector('.hero-meta');
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
    if (peek) {
      // Keep the whole card inside the viewport, even at the edges
      var pw = peek.offsetWidth, ph = peek.offsetHeight, m = 16;
      var gx = tx, gy = ty;
      if (window.innerWidth > pw + 2 * m) gx = Math.min(Math.max(tx, pw / 2 + m), window.innerWidth - pw / 2 - m);
      else gx = window.innerWidth / 2;
      if (window.innerHeight > ph + 2 * m) gy = Math.min(Math.max(ty, ph / 2 + m), window.innerHeight - ph / 2 - m);
      else gy = window.innerHeight / 2;
      px += (gx - px) * 0.14; py += (gy - py) * 0.14;
      peek.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0) translate(-50%,-50%) scale(' + (peekOn ? 1 : 0.85) + ')';
    }
    if (y < heroH()) {
      var hp = Math.min(1, y / heroH());
      heroInner.style.transform = 'translate3d(0,' + (hp * 40) + 'px,0)';
      heroInner.style.opacity = String(1 - hp * 0.55);
    }
    if (bubble) {
      bx += (tx - bx) * 0.18; by += (ty - by) * 0.18;
      bubble.style.transform = 'translate3d(' + bx + 'px,' + by + 'px,0) translate(-50%,-50%) scale(' + (bubbleOn ? 1 : 0.2) + ')';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Process timeline: progress follows scroll - the line draws, markers pop and a runner travels the line
  (function () {
    var tl = document.querySelector('.timeline');
    if (!tl || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('tl-armed');
    var marks = Array.prototype.slice.call(tl.querySelectorAll('i'));
    var ticking = false;
    function update() {
      ticking = false;
      var r = tl.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var p = (vh * 0.88 - r.top) / (vh * 0.55);
      p = Math.max(0, Math.min(1, p));
      tl.style.setProperty('--p', p.toFixed(4));
      tl.classList.toggle('run', p > 0.02);
      var w = tl.clientWidth;
      marks.forEach(function (m) {
        m.classList.toggle('on', p * (w - 9) >= m.offsetLeft + 1);
      });
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  })();
})();

// Footer signoff: letters rise in when the footer scrolls into view
;(function () {
  var s = document.querySelector('.signoff');
  if (!s) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    var so = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { s.classList.add('in'); so.disconnect(); } });
    }, { threshold: 0.2 });
    so.observe(s);
  } else {
    s.classList.add('in');
  }
})();
