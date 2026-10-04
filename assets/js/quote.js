/* ==========================================================================
   Kulkavach — multi-step "Request Manpower / Get a Quote" form
   Handles: step navigation, per-step validation, progress, file attachments,
            review summary, submission (endpoint or no-backend fallback),
            and the confirmation screen.
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('quoteForm');
  if (!form) return;

  var CFG = window.KULKAVACH || {};
  var card = form.closest('.formcard') || form.parentNode;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.fstep'));
  var btnBack = form.querySelector('[data-back]');
  var btnNext = form.querySelector('[data-next]');
  var btnSubmit = form.querySelector('[data-submit]');
  var success = document.getElementById('quoteSuccess');

  // The progress indicator sits in .formcard__head — outside <form> — so it
  // must be queried from the card, not the form.
  var fill = card.querySelector('.progress__fill');
  var progressTrack = card.querySelector('.progress__track');
  var stepNow = card.querySelector('[data-step-now]');
  var stepLabel = card.querySelector('[data-step-label]');
  var stepItems = Array.prototype.slice.call(card.querySelectorAll('.progress__steps li'));

  var current = 0;
  var attachments = [];
  var MAX_FILES = 3;
  var MAX_BYTES = 8 * 1024 * 1024;   // 8 MB per file

  var LABELS = ['Requirement', 'Location & duration', 'Your details'];

  /* ---------------------------------------------------------------
     Step rendering
     --------------------------------------------------------------- */
  function render() {
    steps.forEach(function (s, i) { s.classList.toggle('is-active', i === current); });

    var pct = ((current + 1) / steps.length) * 100;
    if (fill) fill.style.width = pct.toFixed(2) + '%';
    if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(current + 1));
    if (stepNow) stepNow.textContent = String(current + 1);
    if (stepLabel) stepLabel.textContent = LABELS[current];

    stepItems.forEach(function (li, i) {
      li.classList.toggle('is-active', i === current);
      li.classList.toggle('is-done', i < current);
    });

    if (btnBack) btnBack.style.visibility = current === 0 ? 'hidden' : 'visible';
    if (btnNext) btnNext.hidden = current === steps.length - 1;
    if (btnSubmit) btnSubmit.hidden = current !== steps.length - 1;

    if (current === steps.length - 1) buildReview();

    // Keep the form header in view when stepping on small screens
    if (card && current > 0) {
      var top = card.getBoundingClientRect().top + window.scrollY - 90;
      if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  /* ---------------------------------------------------------------
     Validation — only the fields inside the current step
     --------------------------------------------------------------- */
  function fieldOf(el) { return el.closest('.field') || el.closest('.fieldset'); }

  function setError(el, msg) {
    var f = fieldOf(el);
    if (!f) return;
    f.classList.add('is-invalid');
    var e = f.querySelector('.error-msg');
    if (e && msg) e.textContent = msg;
  }

  function clearError(el) {
    var f = fieldOf(el);
    if (f) f.classList.remove('is-invalid');
  }

  function validateStep(index) {
    var step = steps[index];
    var ok = true;
    var firstBad = null;

    // Required inputs / selects / textareas
    step.querySelectorAll('[required]').forEach(function (el) {
      if (el.type === 'radio' || el.type === 'checkbox') return;   // handled below
      var val = (el.value || '').trim();
      var bad = false, msg = '';

      if (!val) { bad = true; msg = 'This field is required.'; }
      else if (el.type === 'tel' && !/^[6-9]\d{9}$/.test(val.replace(/\D/g, '').slice(-10))) {
        bad = true; msg = 'Enter a valid 10-digit Indian mobile number.';
      }
      else if (el.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
        bad = true; msg = 'Enter a valid email address.';
      }
      else if (el.type === 'number') {
        var n = parseInt(val, 10);
        var min = parseInt(el.min || '1', 10);
        if (isNaN(n) || n < min) { bad = true; msg = 'Enter a number of ' + min + ' or more.'; }
      }

      if (bad) { setError(el, msg); ok = false; firstBad = firstBad || el; }
      else clearError(el);
    });

    // Required radio groups
    var groups = {};
    step.querySelectorAll('input[type="radio"][data-required-group]').forEach(function (r) {
      groups[r.name] = groups[r.name] || [];
      groups[r.name].push(r);
    });
    Object.keys(groups).forEach(function (name) {
      var list = groups[name];
      var chosen = list.some(function (r) { return r.checked; });
      if (!chosen) { setError(list[0], 'Please choose one option.'); ok = false; firstBad = firstBad || list[0]; }
      else clearError(list[0]);
    });

    // Required consent checkbox
    step.querySelectorAll('input[type="checkbox"][required]').forEach(function (c) {
      if (!c.checked) { setError(c, 'Please tick to continue.'); ok = false; firstBad = firstBad || c; }
      else clearError(c);
    });

    if (firstBad) {
      var f = fieldOf(firstBad);
      (f || firstBad).scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (firstBad.focus) try { firstBad.focus({ preventScroll: true }); } catch (e) { firstBad.focus(); }
    }
    return ok;
  }

  // Clear the error as soon as the user fixes it
  form.addEventListener('input', function (e) { clearError(e.target); });
  form.addEventListener('change', function (e) { clearError(e.target); });

  /* ---------------------------------------------------------------
     Review summary shown on the final step
     --------------------------------------------------------------- */
  function labelFor(el) {
    if (el.type === 'radio' || el.type === 'checkbox') {
      var box = el.closest('.opt');
      var l = box && box.querySelector('.opt__label');
      return l ? l.textContent.trim() : el.value;
    }
    if (el.tagName === 'SELECT') {
      return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
    }
    return el.value;
  }

  function buildReview() {
    var host = form.querySelector('[data-review]');
    if (!host) return;

    var rows = [];
    var add = function (k, v) { if (v) rows.push([k, v]); };

    var svc = form.querySelector('input[name="requirementType"]:checked');
    add('Requirement', svc ? labelFor(svc) : '');
    add('Personnel needed', form.elements.headcount ? form.elements.headcount.value : '');

    var shift = form.querySelector('input[name="shift"]:checked');
    add('Shift pattern', shift ? labelFor(shift) : '');
    add('Site type', form.elements.siteType ? labelFor(form.elements.siteType) : '');
    add('City', form.elements.city ? labelFor(form.elements.city) : '');
    add('Start date', form.elements.startDate ? form.elements.startDate.value : '');

    var dur = form.querySelector('input[name="duration"]:checked');
    add('Duration', dur ? labelFor(dur) : '');

    host.innerHTML = '<dl>' + rows.map(function (r) {
      return '<dt>' + r[0] + '</dt><dd>' + escapeHtml(r[1]) + '</dd>';
    }).join('') + '</dl>';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------------------
     File attachments (optional)
     --------------------------------------------------------------- */
  function initUpload() {
    var zone = form.querySelector('.dropzone');
    var input = form.querySelector('#attachment');
    var list = form.querySelector('[data-filelist]');
    if (!zone || !input) return;

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (t) {
      zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add('is-drag'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove('is-drag'); });
    });
    zone.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });

    function addFiles(files) {
      Array.prototype.slice.call(files).forEach(function (f) {
        if (attachments.length >= MAX_FILES) return;
        if (f.size > MAX_BYTES) { alert('"' + f.name + '" is larger than 8 MB. Please attach a smaller file.'); return; }
        attachments.push(f);
      });
      renderFiles();
    }

    function renderFiles() {
      if (!list) return;
      list.innerHTML = attachments.map(function (f, i) {
        return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">' +
               '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>' +
               '<span>' + escapeHtml(f.name) + '</span>' +
               '<em class="small muted" style="font-style:normal">' + (f.size / 1024 / 1024).toFixed(1) + ' MB</em>' +
               '<button type="button" data-rm="' + i + '" aria-label="Remove ' + escapeHtml(f.name) + '">&times;</button></li>';
      }).join('');
    }

    list && list.addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]');
      if (!b) return;
      attachments.splice(parseInt(b.getAttribute('data-rm'), 10), 1);
      renderFiles();
    });
  }

  /* ---------------------------------------------------------------
     Submission
     --------------------------------------------------------------- */
  function reference() {
    var p = (CFG.forms && CFG.forms.refPrefix) || 'KV';
    var d = new Date();
    var stamp = String(d.getFullYear()).slice(2) +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0');
    var rnd = Math.floor(1000 + Math.random() * 9000);
    return p + '-' + stamp + '-' + rnd;
  }

  function collect() {
    var data = {};
    Array.prototype.slice.call(form.elements).forEach(function (el) {
      if (!el.name || el.type === 'file') return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      data[el.name] = (el.type === 'checkbox') ? 'Yes' : el.value;
    });
    return data;
  }

  function whatsappSummary(data, ref) {
    var L = [];
    L.push('*New requirement — ' + (CFG.brand ? CFG.brand.name : 'Kulkavach') + '*');
    L.push('Ref: ' + ref);
    L.push('');
    L.push('Requirement: ' + (data.requirementType || '-'));
    L.push('Personnel: ' + (data.headcount || '-'));
    L.push('Shift: ' + (data.shift || '-'));
    L.push('Site type: ' + (data.siteType || '-'));
    L.push('City: ' + (data.city || '-'));
    L.push('Location: ' + (data.locality || '-'));
    L.push('Start: ' + (data.startDate || '-'));
    L.push('Duration: ' + (data.duration || '-'));
    L.push('');
    L.push('Name: ' + (data.name || '-'));
    L.push('Company: ' + (data.company || '-'));
    L.push('Phone: ' + (data.phone || '-'));
    L.push('Email: ' + (data.email || '-'));
    if (data.notes) { L.push(''); L.push('Notes: ' + data.notes); }
    if (attachments.length) { L.push(''); L.push('(' + attachments.length + ' file(s) to be sent separately)'); }
    return L.join('\n');
  }

  function showSuccess(data, ref) {
    if (!success) return;
    form.style.display = 'none';
    var head = card && card.querySelector('.formcard__head');
    if (head) head.style.display = 'none';
    success.classList.add('is-active');

    var nameEl = success.querySelector('[data-success-name]');
    if (nameEl) nameEl.textContent = (data.name || '').split(' ')[0] || 'there';
    var refEl = success.querySelector('[data-success-ref]');
    if (refEl) refEl.textContent = ref;

    var wa = success.querySelector('[data-success-wa]');
    if (wa && window.KV_waLink) {
      wa.setAttribute('href', window.KV_waLink('Hi, I have just submitted requirement ' + ref + '. Adding a few more details:'));
    }

    success.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function setBusy(on) {
    if (!btnSubmit) return;
    btnSubmit.disabled = on;
    btnSubmit.textContent = on ? 'Sending…' : btnSubmit.getAttribute('data-label') || 'Submit request';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validateStep(current)) return;

    var data = collect();
    var ref = reference();
    data.reference = ref;
    data.submittedAt = new Date().toISOString();
    data.source = 'website: ' + location.pathname;

    var endpoint = CFG.forms && CFG.forms.endpoint;
    setBusy(true);

    if (endpoint) {
      var fd = new FormData();
      Object.keys(data).forEach(function (k) { fd.append(k, data[k]); });
      attachments.forEach(function (f) { fd.append('attachments', f, f.name); });

      fetch(endpoint, { method: 'POST', body: fd })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          setBusy(false);
          showSuccess(data, ref);
        })
        .catch(function () {
          setBusy(false);
          // Never lose the lead: fall back to WhatsApp hand-off.
          if (CFG.forms && CFG.forms.fallbackToWhatsApp && window.KV_waLink) {
            window.open(window.KV_waLink(whatsappSummary(data, ref)), '_blank', 'noopener');
            showSuccess(data, ref);
          } else {
            alert('We could not send the form just now. Please call us on ' +
                  (CFG.contact ? CFG.contact.phonePrimary : '') + ' — sorry for the trouble.');
          }
        });
    } else {
      // No backend configured yet — hand the structured lead to WhatsApp.
      if (window.KV_waLink) window.open(window.KV_waLink(whatsappSummary(data, ref)), '_blank', 'noopener');
      setBusy(false);
      showSuccess(data, ref);
    }
  });

  /* ---------------------------------------------------------------
     Navigation
     --------------------------------------------------------------- */
  btnNext && btnNext.addEventListener('click', function () {
    if (!validateStep(current)) return;
    current = Math.min(current + 1, steps.length - 1);
    render();
  });

  btnBack && btnBack.addEventListener('click', function () {
    current = Math.max(current - 1, 0);
    render();
  });

  // Enter should advance, not submit, on steps 1–2
  form.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    if (e.target.tagName === 'TEXTAREA') return;
    if (current < steps.length - 1) { e.preventDefault(); btnNext && btnNext.click(); }
  });

  /* ---------------------------------------------------------------
     Pre-fill from the URL:  quote.html?service=security-guards&city=bhopal
     This is what the "Request this service" buttons use.
     --------------------------------------------------------------- */
  function prefill() {
    var q = new URLSearchParams(location.search);

    var service = q.get('service');
    if (service) {
      var radio = form.querySelector('input[name="requirementType"][value="' + service.replace(/"/g, '') + '"]');
      if (radio) radio.checked = true;
    }

    var city = q.get('city');
    if (city && form.elements.city) {
      var opt = Array.prototype.slice.call(form.elements.city.options)
        .filter(function (o) { return o.value.toLowerCase() === city.toLowerCase(); })[0];
      if (opt) form.elements.city.value = opt.value;
    }

    if (q.get('headcount') && form.elements.headcount) form.elements.headcount.value = q.get('headcount');

    // Minimum start date = today
    var sd = form.elements.startDate;
    if (sd) sd.min = new Date().toISOString().split('T')[0];

    // Show which service was pre-selected, so it doesn't feel like a random default
    var flag = form.querySelector('[data-prefill-note]');
    if (flag && service && form.querySelector('input[name="requirementType"]:checked')) {
      var chosen = form.querySelector('input[name="requirementType"]:checked');
      flag.hidden = false;
      flag.innerHTML = '<strong>Pre-selected:</strong> ' + escapeHtml(labelFor(chosen)) +
                       ' — change it below if you need something else.';
    }
  }

  initUpload();
  prefill();
  render();
})();
