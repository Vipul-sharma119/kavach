/* ==========================================================================
   Kulkavach — shared site behaviour
   Loaded on every page. Depends on config.js.
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.KULKAVACH || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /** Read a dotted path out of the config object: get('contact.phonePrimary') */
  function get(path) {
    return path.split('.').reduce(function (o, k) {
      return (o && o[k] !== undefined) ? o[k] : undefined;
    }, CFG);
  }

  function digits(s) { return String(s || '').replace(/[^\d+]/g, ''); }

  /** Build a wa.me link with a pre-filled, structured opening message. */
  function waLink(message) {
    var num = get('contact.whatsapp') || '';
    var msg = message || defaultWaMessage();
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
  }

  function defaultWaMessage() {
    var svc = document.body.getAttribute('data-wa-service') || 'Security Guards / Manpower';
    return 'Hi ' + (get('brand.name') || 'Kulkavach') + ', I need ' + svc + ' at [Location]. Please share a quote.';
  }
  window.KV_waLink = waLink;   // reused by quote.js / careers.js

  /* ======================================================================
     1. Inject config values into the markup
     ---------------------------------------------------------------------
       <span data-kv="contact.phonePrimary"></span>
       <a data-kv-href="tel:contact.phonePrimary">
       <a data-kv-href="mailto:contact.email">
       <a data-kv-href="wa">                      → pre-filled WhatsApp
       <a data-kv-href="maps">                    → Google Maps pin
     ====================================================================== */
  function hydrateConfig() {
    $$('[data-kv]').forEach(function (el) {
      var v = get(el.getAttribute('data-kv'));
      if (v !== undefined && v !== null) el.textContent = v;
    });

    $$('[data-kv-href]').forEach(function (el) {
      var spec = el.getAttribute('data-kv-href');
      var href = '';

      if (spec === 'wa') {
        href = waLink(el.getAttribute('data-wa-message') || null);
        el.target = '_blank'; el.rel = 'noopener';
      } else if (spec === 'maps') {
        href = get('contact.address.mapsUrl') || '#';
        el.target = '_blank'; el.rel = 'noopener';
      } else if (spec.indexOf('tel:') === 0) {
        href = 'tel:' + digits(get(spec.slice(4)));
      } else if (spec.indexOf('mailto:') === 0) {
        href = 'mailto:' + (get(spec.slice(7)) || '');
      } else {
        href = get(spec) || '#';
      }
      el.setAttribute('href', href);
    });

    // Year in footer
    $$('[data-kv-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

    // Years-in-business, derived so it never goes stale
    $$('[data-kv-age]').forEach(function (el) {
      var f = get('brand.foundedYear');
      if (f) el.textContent = String(new Date().getFullYear() - f);
    });
  }

  /* ======================================================================
     2. Header: shadow on scroll, mobile drawer, services dropdown
     ====================================================================== */
  function initHeader() {
    var header = $('.header');
    var burger = $('.burger');
    var nav = $('#primary-nav');

    if (header) {
      var onScroll = function () {
        header.classList.toggle('is-stuck', window.scrollY > 4);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
      });
    }

    // Dropdown — click on touch/mobile, hover on desktop
    $$('.nav__item').forEach(function (item) {
      var btn = $('.nav__toggle', item);
      if (!btn) return;

      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });

      if (window.matchMedia('(min-width: 1025px)').matches) {
        item.addEventListener('mouseenter', function () { item.classList.add('is-open'); });
        item.addEventListener('mouseleave', function () { item.classList.remove('is-open'); });
      }
    });

    document.addEventListener('click', function () {
      $$('.nav__item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.nav__item.is-open').forEach(function (i) { i.classList.remove('is-open'); });
      if (nav && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  /* ======================================================================
     3. Sticky "Get a Quote" bar — appears once the hero CTA scrolls away
     ====================================================================== */
  function initStickyBar() {
    var bar = $('.stickybar');
    if (!bar) return;

    var trigger = $('[data-sticky-trigger]') || $('.hero') || $('.pagehead');
    if (!trigger) return;

    var show = function (on) {
      bar.classList.toggle('is-visible', on);
      document.body.classList.toggle('has-stickybar', on);
    };

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        show(!entries[0].isIntersecting);
      }, { rootMargin: '-120px 0px 0px 0px' }).observe(trigger);
    } else {
      window.addEventListener('scroll', function () { show(window.scrollY > 500); }, { passive: true });
    }
  }

  /* ======================================================================
     4. Animated trust counters — count up when scrolled into view
     ====================================================================== */
  function buildCounters() {
    $$('[data-counters]').forEach(function (host) {
      if (host.children.length) return;             // markup already hand-written
      (get('stats') || []).forEach(function (s) {
        var el = document.createElement('div');
        el.className = 'counter';
        el.innerHTML =
          '<div class="counter__num" data-count="' + s.value + '" data-suffix="' + (s.suffix || '') + '">0</div>' +
          '<div class="counter__label">' + s.label + '</div>';
        host.appendChild(el);
      });
    });
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var suffix = el.getAttribute('data-suffix') || '';
    var render = function (n) {
      el.innerHTML = Math.round(n).toLocaleString('en-IN') +
        (suffix ? '<span class="suffix">' + suffix + '</span>' : '');
    };

    if (reduceMotion) { render(target); return; }

    var dur = 1500, start = null;
    var tick = function (ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      render(target * (1 - Math.pow(1 - p, 3)));   // ease-out cubic
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function initCounters() {
    buildCounters();
    var nums = $$('[data-count]');
    if (!nums.length) return;

    if (!('IntersectionObserver' in window)) { nums.forEach(animateCount); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        animateCount(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.45 });

    nums.forEach(function (n) { io.observe(n); });
  }

  /* ======================================================================
     5. Scroll reveal
     ====================================================================== */
  function initReveal() {
    var els = $$('.reveal');
    if (!els.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        setTimeout(function () { e.target.classList.add('is-in'); }, (i % 4) * 70);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el) { io.observe(el); });
  }

  /* ======================================================================
     6. FAQ accordion
     ====================================================================== */
  function initAccordions() {
    $$('.acc__btn').forEach(function (btn) {
      var acc = btn.closest('.acc');
      var panel = $('.acc__panel', acc);
      btn.setAttribute('aria-expanded', acc.classList.contains('is-open') ? 'true' : 'false');

      btn.addEventListener('click', function () {
        var open = acc.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      });
    });

    // Deep-link: faq.html#billing opens that item
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target && target.classList.contains('acc')) {
        target.classList.add('is-open');
        $('.acc__btn', target).setAttribute('aria-expanded', 'true');
      }
    }
  }

  /* ======================================================================
     7. Modal (PSARA verification seal, and any [data-modal-open])
     ====================================================================== */
  var lastFocus = null;

  function openModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    lastFocus = document.activeElement;
    m.classList.add('is-open');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var focusable = $('.modal__x', m) || m;
    focusable.focus();
  }

  function closeModal(m) {
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  function initModals() {
    $$('[data-modal-open]').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        openModal(t.getAttribute('data-modal-open'));
      });
    });

    $$('.modal').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === m || e.target.closest('[data-modal-close]')) closeModal(m);
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.modal.is-open').forEach(closeModal);
    });
  }

  /* ======================================================================
     8. Coverage map — clickable city pins + chips
     ====================================================================== */
  function initCoverageMap() {
    var map = $('[data-coverage-map]');
    if (!map) return;

    var branches = get('branches') || [];
    var pinLayer = $('[data-pins]', map);
    var chips = $('[data-city-chips]');
    var info = $('[data-city-info]');
    var NS = 'http://www.w3.org/2000/svg';

    branches.forEach(function (b) {
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'pin' + (b.hq ? ' pin--hq' : ''));
      g.setAttribute('data-city', b.id);
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', b.name + ' — ' + b.role);

      var halo = document.createElementNS(NS, 'circle');
      halo.setAttribute('class', 'halo');
      halo.setAttribute('cx', b.x); halo.setAttribute('cy', b.y); halo.setAttribute('r', '16');

      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('class', 'dot');
      dot.setAttribute('cx', b.x); dot.setAttribute('cy', b.y); dot.setAttribute('r', b.hq ? '9' : '7');

      var label = document.createElementNS(NS, 'text');
      label.setAttribute('x', b.x);
      label.setAttribute('y', b.labelBelow ? b.y + 34 : b.y - 24);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = b.name;

      g.appendChild(halo); g.appendChild(dot); g.appendChild(label);
      pinLayer.appendChild(g);

      g.addEventListener('click', function () { selectCity(b.id); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectCity(b.id); }
      });
    });

    if (chips) {
      branches.forEach(function (b) {
        var c = document.createElement('button');
        c.type = 'button';
        c.className = 'citychip';
        c.setAttribute('data-city', b.id);
        c.textContent = b.name;
        c.addEventListener('click', function () { selectCity(b.id); });
        chips.appendChild(c);
      });
    }

    function selectCity(id) {
      var b = branches.filter(function (x) { return x.id === id; })[0];
      if (!b) return;

      $$('.pin', map).forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-city') === id); });
      $$('.citychip').forEach(function (p) { p.classList.toggle('is-active', p.getAttribute('data-city') === id); });

      if (!info) return;
      info.innerHTML =
        '<span class="cityinfo__badge">' + (b.hq ? 'Head office' : 'Branch') + '</span>' +
        '<h3>' + b.name + '</h3>' +
        '<p class="small" style="color:#93A1BB;margin-bottom:0">' + b.role + '</p>' +
        '<dl>' +
          '<dt>Operating since</dt><dd>' + b.since + '</dd>' +
          '<dt>Current strength</dt><dd>' + b.staff + '</dd>' +
          '<dt>Direct line</dt><dd><a style="color:#fff;text-decoration:none" href="tel:' + digits(b.phone) + '">' + b.phone + '</a></dd>' +
        '</dl>' +
        '<p class="small" style="color:#93A1BB">Areas covered: ' + b.areas + '</p>' +
        '<a class="btn btn--primary btn--sm btn--block" href="quote.html?city=' + b.id + '">Request staff in ' + b.name + '</a>';

      // Contact page: swap the displayed branch phone + map
      var branchPhone = $('[data-branch-phone]');
      if (branchPhone) {
        branchPhone.textContent = b.phone;
        branchPhone.setAttribute('href', 'tel:' + digits(b.phone));
      }
    }

    var initial = (location.hash || '').replace('#', '');
    selectCity(branches.some(function (b) { return b.id === initial; }) ? initial : (branches[0] && branches[0].id));
    window.KV_selectCity = selectCity;
  }

  /* ======================================================================
     9. Contact page — branch selector drives phone + embedded map
     ====================================================================== */
  function initBranchSelect() {
    var sel = $('[data-branch-select]');
    if (!sel) return;

    var branches = get('branches') || [];
    branches.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b.id;
      o.textContent = b.name + (b.hq ? ' — Head office' : '');
      sel.appendChild(o);
    });

    var frame = $('[data-branch-map]');
    var addr = $('[data-branch-areas]');
    var role = $('[data-branch-role]');

    function apply() {
      var b = branches.filter(function (x) { return x.id === sel.value; })[0];
      if (!b) return;

      var phone = $('[data-branch-phone]');
      if (phone) { phone.textContent = b.phone; phone.setAttribute('href', 'tel:' + digits(b.phone)); }
      if (addr) addr.textContent = b.areas;
      if (role) role.textContent = b.role;
      if (frame) {
        frame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(b.name + ', Madhya Pradesh, India') + '&output=embed';
      }
      if (window.KV_selectCity) window.KV_selectCity(b.id);
    }

    sel.addEventListener('change', apply);
    sel.value = (branches[0] || {}).id || '';
    apply();
  }

  /* ======================================================================
     10. Response-time badges + confirmation copy read from config
     ====================================================================== */
  function initResponseCopy() {
    var h = get('contact.responseHours');
    if (!h) return;
    $$('[data-response-hours]').forEach(function (el) { el.textContent = h; });
  }

  /* ======================================================================
     11. Demo banner — shown while config.demo.enabled is true, so nobody
         mistakes the placeholder licence numbers and stats for real claims.
     ====================================================================== */
  function initDemoBanner() {
    var demo = get('demo');
    if (!demo || !demo.enabled) return;
    if (document.querySelector('.demobar')) return;

    var bar = document.createElement('div');
    bar.className = 'demobar';
    bar.setAttribute('role', 'note');
    bar.innerHTML =
      '<div class="wrap demobar__inner">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
          '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>' +
        '<span><strong>Demo preview.</strong> ' + (demo.note || '') + '</span>' +
        '<button type="button" class="demobar__x" aria-label="Hide this notice">&times;</button>' +
      '</div>';

    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector('.demobar__x').addEventListener('click', function () {
      bar.remove();
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    initDemoBanner();
    hydrateConfig();
    initHeader();
    initStickyBar();
    initCounters();
    initReveal();
    initAccordions();
    initModals();
    initCoverageMap();
    initBranchSelect();
    initResponseCopy();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
