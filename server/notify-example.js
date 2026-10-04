/**
 * ===========================================================================
 * Kulkavach — lead notification endpoint (reference implementation)
 * ---------------------------------------------------------------------------
 * The website's quote and careers forms POST multipart/form-data to a single
 * endpoint. This file shows what that endpoint needs to do:
 *
 *   1. Accept the submission (fields + optional file attachments)
 *   2. Email the ops team immediately, attachments included
 *   3. Fire a WhatsApp alert to the ops team so no lead sits unseen
 *   4. Append the lead to a log/sheet so nothing depends on one inbox
 *   5. Return 200 — anything else makes the browser fall back to WhatsApp
 *
 * This is a working Express app, not pseudocode. To use it:
 *
 *   cd server
 *   npm init -y
 *   npm install express multer nodemailer cors dotenv
 *   cp .env.example .env      # then fill in your real values
 *   node notify-example.js
 *
 * Then set in assets/js/config.js:
 *   forms: { endpoint: 'https://your-host/api/lead', ... }
 *
 * If you would rather not run a server at all, see README.md § "No-backend
 * options" — Formspree / Web3Forms / Google Apps Script all work with the
 * same form, and the site already falls back to WhatsApp if none is set.
 * ===========================================================================
 */

'use strict';

require('dotenv').config();

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* --------------------------------------------------------------------------
   Uploads: keep in memory so we can attach straight to the email.
   3 files max, 8 MB each — matches the limits enforced in the browser.
   -------------------------------------------------------------------------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 3 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(pdf|docx?|xlsx?|jpe?g|png)$/i.test(file.originalname);
    cb(ok ? null : new Error('Unsupported file type'), ok);
  }
});

/* Only accept posts from your own site. */
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'https://www.kulkavach.in')
    .split(',').map(s => s.trim()),
  methods: ['POST']
}));

app.use(express.urlencoded({ extended: true }));

/* --------------------------------------------------------------------------
   Very small in-memory rate limit — enough to stop casual form spam.
   Behind a load balancer or multiple instances, use Redis instead.
   -------------------------------------------------------------------------- */
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;   // 10 minutes
  const max = 8;

  const list = (hits.get(ip) || []).filter(t => now - t < windowMs);
  if (list.length >= max) {
    return res.status(429).json({ ok: false, error: 'Too many submissions. Please call us instead.' });
  }
  list.push(now);
  hits.set(ip, list);
  next();
}

/* -------------------------------------------------------------------------- */

const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE) === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FIELD_LABELS = {
  reference: 'Reference',
  requirementType: 'Requirement',
  headcount: 'Personnel needed',
  shift: 'Shift pattern',
  siteType: 'Site type',
  city: 'City',
  locality: 'Site area',
  startDate: 'Required from',
  duration: 'Duration',
  specialRequirement: 'Special requirement',
  name: 'Name',
  company: 'Company',
  phone: 'Phone',
  email: 'Email',
  notes: 'Notes',
  role: 'Role applied for',
  age: 'Age',
  height: 'Height (cm)',
  experience: 'Experience',
  exServiceman: 'Ex-serviceman',
  availability: 'Available from',
  source: 'Source',
  submittedAt: 'Submitted at'
};

function asRows(body) {
  return Object.keys(FIELD_LABELS)
    .filter(k => body[k])
    .map(k => `<tr><td style="padding:6px 14px 6px 0;color:#667;white-space:nowrap">${FIELD_LABELS[k]}</td>
                   <td style="padding:6px 0;font-weight:600">${esc(body[k])}</td></tr>`)
    .join('');
}

function asText(body) {
  return Object.keys(FIELD_LABELS)
    .filter(k => body[k])
    .map(k => `${FIELD_LABELS[k]}: ${body[k]}`)
    .join('\n');
}

/* --------------------------------------------------------------------------
   WhatsApp alert to the ops team.
   Uses the WhatsApp Cloud API. You need a Meta Business account, a phone
   number ID and a permanent access token, plus an APPROVED message template
   — the Cloud API will not send free-form text to a number that has not
   messaged you in the last 24 hours.

   Create a template named e.g. `new_lead` with body:
     "New enquiry {{1}} from {{2}} ({{3}}) — {{4}} in {{5}}. Check email for details."

   Skip this whole function and use email only if you would rather not set up
   the Cloud API; the site works fine either way.
   -------------------------------------------------------------------------- */
async function whatsappAlert(body) {
  const { WA_PHONE_ID, WA_TOKEN, WA_TO, WA_TEMPLATE } = process.env;
  if (!WA_PHONE_ID || !WA_TOKEN || !WA_TO) return;   // not configured — skip quietly

  const params = [
    body.reference || '-',
    body.name || '-',
    body.phone || '-',
    body.requirementType || body.role || '-',
    body.city || body.locality || '-'
  ].map(text => ({ type: 'text', text: String(text).slice(0, 60) }));

  // WA_TO may hold several numbers, comma separated — alert the whole ops desk.
  const recipients = WA_TO.split(',').map(s => s.trim()).filter(Boolean);

  await Promise.all(recipients.map(to =>
    fetch(`https://graph.facebook.com/v20.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: WA_TEMPLATE || 'new_lead',
          language: { code: 'en' },
          components: [{ type: 'body', parameters: params }]
        }
      })
    }).then(async r => {
      if (!r.ok) console.error('WhatsApp alert failed:', to, await r.text());
    })
  ));
}

/* --------------------------------------------------------------------------
   Append every lead to a newline-delimited JSON file.
   One inbox is a single point of failure; this is the cheap insurance.
   Swap for a database or a Google Sheet append if you prefer.
   -------------------------------------------------------------------------- */
function logLead(body, files) {
  const dir = path.join(__dirname, 'leads');
  fs.mkdirSync(dir, { recursive: true });
  const record = Object.assign({}, body, {
    attachments: (files || []).map(f => f.originalname),
    receivedAt: new Date().toISOString()
  });
  fs.appendFileSync(path.join(dir, 'leads.ndjson'), JSON.stringify(record) + '\n');
}

/* -------------------------------------------------------------------------- */

app.post('/api/lead', rateLimit, upload.array('attachments', 3), async (req, res) => {
  const body = req.body || {};
  const files = req.files || [];

  // Honeypot / sanity check: a real submission always carries these.
  if (!body.name || !body.phone) {
    return res.status(400).json({ ok: false, error: 'Missing name or phone' });
  }

  const isApplication = body.formType === 'application';
  const subject = isApplication
    ? `Job application ${body.reference || ''} — ${body.name} (${body.role || 'role not stated'})`
    : `New enquiry ${body.reference || ''} — ${body.name}${body.company ? ' / ' + body.company : ''}`;

  // 1 & 4 first: log before anything that can fail on the network.
  try { logLead(body, files); } catch (e) { console.error('Lead log failed:', e); }

  const html = `
    <div style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#16203A">
      <h2 style="margin:0 0 4px">${isApplication ? 'New job application' : 'New requirement enquiry'}</h2>
      <p style="margin:0 0 18px;color:#667">Received ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
      <table style="border-collapse:collapse;font-size:14px">${asRows(body)}</table>
      ${files.length ? `<p style="margin-top:18px;color:#667">${files.length} attachment(s) included.</p>` : ''}
      <p style="margin-top:22px">
        <a href="tel:${esc(body.phone)}" style="background:#D8A93B;color:#241A03;padding:10px 18px;border-radius:99px;text-decoration:none;font-weight:700">Call ${esc(body.name)}</a>
      </p>
    </div>`;

  try {
    // 2. Email the ops team, with attachments.
    await mailer.sendMail({
      from: process.env.MAIL_FROM,
      to: isApplication
        ? (process.env.MAIL_TO_CAREERS || process.env.MAIL_TO)
        : process.env.MAIL_TO,
      replyTo: body.email || undefined,
      subject,
      text: asText(body),
      html,
      attachments: files.map(f => ({ filename: f.originalname, content: f.buffer }))
    });

    // 3. WhatsApp alert — never let this failure lose the lead.
    whatsappAlert(body).catch(e => console.error('WhatsApp alert error:', e));

    // Optional: acknowledgement to the client, if they gave an email.
    if (body.email && !isApplication) {
      mailer.sendMail({
        from: process.env.MAIL_FROM,
        to: body.email,
        subject: `We have your requirement — ref ${body.reference || ''}`,
        text: `Dear ${body.name},\n\nThank you for contacting Kulkavach. Your requirement has been received `
            + `under reference ${body.reference || '-'}.\n\nOur team will call you within 4 business hours to `
            + `confirm the details, and you will have a written quote the same day.\n\n`
            + `If it is urgent, please call us directly on ${process.env.OPS_PHONE || ''}.\n\n`
            + `— Kulkavach Security & Manpower`
      }).catch(e => console.error('Acknowledgement email failed:', e));
    }

    res.json({ ok: true, reference: body.reference });
  } catch (err) {
    console.error('Lead handling failed:', err);
    // The lead is already in leads.ndjson, and the browser will fall back to
    // WhatsApp on a non-200 — so a failure here still does not lose the enquiry.
    res.status(500).json({ ok: false, error: 'Could not send notification' });
  }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Lead endpoint listening on :${PORT}`));
