/* ==========================================================================
   Kulkavach — "Join as Guard / Staff" application form
   Single-step form; same submission contract as quote.js
   (posts to CFG.forms.endpoint with formType=application, WhatsApp fallback).
   ========================================================================== */
(function () {
  'use strict';

  var form = document.getElementById('careersForm');
  if (!form) return;

  var CFG = window.KULKAVACH || {};
  var success = document.getElementById('careersSuccess');
  var btn = form.querySelector('[data-submit]');
  var resumeFile = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fieldOf(el) { return el.closest('.field'); }
  function setError(el, msg) {
    var f = fieldOf(el); if (!f) return;
    f.classList.add('is-invalid');
    var e = f.querySelector('.error-msg'); if (e && msg) e.textContent = msg;
  }
  form.addEventListener('input', function (e) {
    var f = fieldOf(e.target); if (f) f.classList.remove('is-invalid');
  });
  form.addEventListener('change', function (e) {
    var f = fieldOf(e.target); if (f) f.classList.remove('is-invalid');
  });

  function validate() {
    var ok = true, firstBad = null;

    form.querySelectorAll('[required]').forEach(function (el) {
      if (el.type === 'radio') return;
      var val = (el.value || '').trim();
      var bad = false, msg = '';

      if (el.type === 'checkbox') { bad = !el.checked; msg = 'Please tick to continue.'; }
      else if (!val) { bad = true; msg = 'This field is required.'; }
      else if (el.type === 'tel' && !/^[6-9]\d{9}$/.test(val.replace(/\D/g, '').slice(-10))) {
        bad = true; msg = 'Enter a valid 10-digit mobile number.';
      }
      else if (el.type === 'number') {
        var n = parseInt(val, 10);
        if (isNaN(n) || n < parseInt(el.min || '0', 10) || n > parseInt(el.max || '999', 10)) {
          bad = true; msg = 'Enter a value between ' + el.min + ' and ' + el.max + '.';
        }
      }

      if (bad) { setError(el, msg); ok = false; firstBad = firstBad || el; }
      else { var f = fieldOf(el); if (f) f.classList.remove('is-invalid'); }
    });

    var roleChosen = form.querySelector('input[name="role"]:checked');
    if (!roleChosen) {
      var first = form.querySelector('input[name="role"]');
      if (first) { setError(first, 'Please choose a role.'); ok = false; firstBad = firstBad || first; }
    }

    if (firstBad) {
      (fieldOf(firstBad) || firstBad).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return ok;
  }

  /* ---------- résumé / document upload (optional) ---------- */
  var zone = form.querySelector('.dropzone');
  var input = form.querySelector('#resume');
  var list = form.querySelector('[data-filelist]');

  if (zone && input) {
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
    zone.addEventListener('drop', function (e) { take(e.dataTransfer.files[0]); });
    input.addEventListener('change', function () { take(input.files[0]); });

    function take(f) {
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) { alert('File is larger than 8 MB. Please attach a smaller file.'); return; }
      resumeFile = f;
      if (list) {
        list.innerHTML = '<li><span>' + esc(f.name) + '</span>' +
          '<em class="small muted" style="font-style:normal">' + (f.size / 1024 / 1024).toFixed(1) + ' MB</em>' +
          '<button type="button" data-rm aria-label="Remove file">&times;</button></li>';
      }
    }

    list && list.addEventListener('click', function (e) {
      if (!e.target.closest('[data-rm]')) return;
      resumeFile = null; list.innerHTML = ''; input.value = '';
    });
  }

  /* ---------- submit ---------- */
  function collect() {
    var d = {};
    Array.prototype.slice.call(form.elements).forEach(function (el) {
      if (!el.name || el.type === 'file') return;
      if ((el.type === 'radio' || el.type === 'checkbox') && !el.checked) return;
      d[el.name] = el.type === 'checkbox' ? 'Yes' : el.value;
    });
    return d;
  }

  function waText(d, ref) {
    return [
      '*Job application — ' + (CFG.brand ? CFG.brand.name : 'Kulkavach') + '*',
      'Ref: ' + ref, '',
      'Name: ' + (d.name || '-'),
      'Phone: ' + (d.phone || '-'),
      'Role: ' + (d.role || '-'),
      'Age: ' + (d.age || '-'),
      'Height: ' + (d.height || '-') + ' cm',
      'Experience: ' + (d.experience || '-'),
      'Ex-serviceman: ' + (d.exServiceman || 'No'),
      'City: ' + (d.city || '-'),
      'Available from: ' + (d.availability || '-')
    ].join('\n');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;

    var d = collect();
    var ref = ((CFG.forms && CFG.forms.refPrefix) || 'KV') + '-APP-' + Math.floor(1000 + Math.random() * 9000);
    d.reference = ref;
    d.formType = 'application';
    d.submittedAt = new Date().toISOString();

    var endpoint = CFG.forms && CFG.forms.endpoint;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

    var done = function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit application'; }
      form.style.display = 'none';
      if (success) {
        success.classList.add('is-active');
        var n = success.querySelector('[data-success-name]');
        if (n) n.textContent = (d.name || '').split(' ')[0] || 'there';
        var r = success.querySelector('[data-success-ref]');
        if (r) r.textContent = ref;
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    if (endpoint) {
      var fd = new FormData();
      Object.keys(d).forEach(function (k) { fd.append(k, d[k]); });
      if (resumeFile) fd.append('attachments', resumeFile, resumeFile.name);

      fetch(endpoint, { method: 'POST', body: fd })
        .then(function (r) { if (!r.ok) throw new Error(r.status); done(); })
        .catch(function () {
          if (window.KV_waLink) window.open(window.KV_waLink(waText(d, ref)), '_blank', 'noopener');
          done();
        });
    } else {
      if (window.KV_waLink) window.open(window.KV_waLink(waText(d, ref)), '_blank', 'noopener');
      done();
    }
  });
})();
