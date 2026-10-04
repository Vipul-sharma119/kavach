# Kulkavach Security Portal

A complete, trust-first marketing site for a PSARA-licensed security and manpower
agency. Plain HTML, CSS and JavaScript — **no build step, no framework, no external
requests.** Open `index.html` in a browser and it works.

---

## Quick start

```bash
# Any static server works. From this folder:
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening the files directly (`file://`) also works, though the Google Maps embed on
the contact page needs to be served over http/https.

---

## Demo mode (currently ON)

This copy is configured as a **client demo**, not a live site:

- A slim banner at the top of every page marks all figures as placeholder samples
- The PSARA licence, GST, EPF and ESIC fields read `SAMPLE — …` instead of
  invented-looking numbers
- Every page carries `<meta name="robots" content="noindex,nofollow">` so search
  engines will not index placeholder compliance claims

**To go live, do all three:**

1. `assets/js/config.js` → set `demo.enabled` to `false`
2. Fill in every `// TODO` in the same file with real details
3. Delete the noindex line from all 12 pages:
   ```bash
   grep -rl "DEMO-ONLY" *.html | xargs sed -i '/DEMO-ONLY/d'
   ```

Then work through the content checklist further down.

---

## Deploying

The site is static, so any host works with **no build command** and a publish
directory of `.` (the repo root).

**Netlify — drag and drop (fastest):** open <https://app.netlify.com/drop> and drag
this folder in. Instant `*.netlify.app` URL, no CLI, no repo needed.

**Netlify or Vercel — connected to GitHub:** push the repo (below), then "Import
from Git" in either dashboard. Every `git push` redeploys automatically, which is
what you want while a client is reviewing.

**GitHub Pages:** repo → Settings → Pages → Source: `main`, folder `/ (root)`.
Free, but no automatic deploy previews.

```bash
# push to GitHub (after creating an empty repo on github.com)
git remote add origin https://github.com/<you>/kulkavach-portal.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `node_modules/` and `server/leads/` — real
credentials and captured personal data will not be committed.

---

## Before you launch — the only file you must edit

**`assets/js/config.js`** is the single source of truth for every business detail:
phone numbers, WhatsApp, email, address, PSARA licence, GST/PF/ESIC codes, the
animated stat counters, branch/coverage cities, and the lead endpoint.

Change a value there and it updates **everywhere on every page** — headers, footers,
the licence modal, the WhatsApp deep links, the coverage map, the contact page.
Every placeholder is marked `// TODO`.

```js
contact: {
  phonePrimary: '+91 94250 00000',   // TODO
  whatsapp:     '919425000000',      // TODO  digits only, country code, no "+"
  ...
}
```

> The WhatsApp number must be **digits only with the country code and no `+`**
> (`919425123456`). This is what `wa.me` links require; a wrong format silently
> opens an empty chat.

---

## Pages

| File | What it is |
|---|---|
| `index.html` | Homepage — hero, animated counters, service selector, process, compliance, coverage map, case studies, testimonials, FAQ preview |
| `services.html` | Services overview / comparison |
| `security-guards.html` | Service page — guards |
| `manpower.html` | Service page — staffing |
| `cctv-surveillance.html` | Service page — CCTV & electronic security |
| `quote.html` | **Multi-step Request Manpower form** (the highest-value page) |
| `about.html` | Why Kulkavach — story, compliance, case studies, testimonials, standards |
| `faq.html` | Full FAQ, four categories, accordion |
| `careers.html` | Join as guard/staff — application form + hiring process |
| `contact.html` | Contact cards, branch selector, coverage map |
| `company-profile.html` | Print-formatted profile for procurement (“Save as PDF”) |
| `portal.html` | Client portal preview (phase 3) |

Plus `robots.txt` and `sitemap.xml` — **update the domain in both** before launch.

---

## How the brief maps to the build

| Brief item | Where it lives |
|---|---|
| Animated trust counters | `index.html`, `about.html`, `company-profile.html` — driven by `config.stats` |
| Sticky CTA bar | Every page except `quote.html` (it would be redundant there) |
| Service selector strip | `index.html` § "Pick a service" |
| PSARA badge → verification modal | Every page — the gold seal opens `#psaraModal` |
| "Request this service" pre-fill | Service pages link to `quote.html?service=security-guards` etc. |
| Process timeline | Every service page + homepage |
| Guard/staff profile snapshot | "Quality standards" section on service pages and `about.html` |
| Multi-step form + progress | `quote.html` / `assets/js/quote.js` |
| Instant confirmation screen | `#quoteSuccess` — greets by name, gives a reference and a real timeframe |
| Auto-notification | `server/notify-example.js` (see below) |
| Optional file upload | Step 3 of the quote form — drag/drop, 3 files, 8 MB each |
| Click-to-WhatsApp | Floating button on every page + inline buttons |
| Region/branch selector | `contact.html` — updates phone, areas and the embedded map |
| Verified testimonials | Homepage + `about.html`, with company and designation |
| Client logo strip | Homepage + `about.html` |
| Live stat bar | Dark stat band on the homepage |
| "Verified & Compliant" section | Homepage + `about.html` |
| Case study snippets | Homepage + `about.html` — Challenge → What we did → Result |
| FAQ accordion | `faq.html` + homepage preview |
| Coverage area map | Homepage + `contact.html` — clickable pins from `config.branches` |
| Careers page | `careers.html` |
| Client login portal | `portal.html` — honest "in development" preview, not a fake login |
| Downloadable company profile | `company-profile.html` → browser "Save as PDF" |
| Response-time badge | Next to the quote form, on service pages, in the sticky bar |

---

## Wiring up lead notifications

Right now the forms work **without any backend**: on submit they open WhatsApp with
the full requirement already formatted as a message, and show the confirmation
screen. Nothing is lost, and you can launch like this on day one.

To get automatic email + WhatsApp alerts to your ops team, set the endpoint:

```js
// assets/js/config.js
forms: { endpoint: 'https://api.kulkavach.in/lead', fallbackToWhatsApp: true }
```

The form POSTs `multipart/form-data` with all fields plus an `attachments` file
array. Any endpoint returning HTTP 200 works. **If the request fails, the site
falls back to WhatsApp automatically** — a broken server never costs you a lead.

### Option A — run the reference server

`server/notify-example.js` is a working Express implementation: emails the ops team
with attachments, fires a WhatsApp Cloud API alert, appends every lead to
`leads.ndjson`, rate-limits spam, and sends the client an acknowledgement.

```bash
cd server
npm init -y && npm install express multer nodemailer cors dotenv
cp .env.example .env      # fill in SMTP + WhatsApp credentials
node notify-example.js
```

### Option B — no server at all

Point `endpoint` at a hosted form service. All of these accept the same POST:

- **Web3Verify / Web3Forms** — free tier, no account server needed
- **Formspree** — email routing plus a submissions dashboard
- **Google Apps Script** — deploy a web app that appends to a Google Sheet

For WhatsApp alerts without the Cloud API, most of these can trigger a Zapier or
Make webhook that sends the alert.

> **WhatsApp Cloud API caveat:** Meta will not let you send free-form text to a
> number that has not messaged you in the last 24 hours. You need an **approved
> message template** — `server/notify-example.js` shows the exact shape. Email
> alerts have no such restriction, which is why the reference server does both.

---

## Content checklist before going live

Everything below is placeholder text written to be realistic, not to be true.
**Replace it or remove it** — publishing invented compliance claims or client
quotes is a legal risk, not just a credibility one.

- [ ] **`config.js`** — every `// TODO`: phones, WhatsApp, emails, address, maps URL
- [ ] **PSARA licence number, issuer and validity dates** — these appear in the
      verification modal and the footer of every page. Must be exact.
- [ ] **GSTIN, EPF establishment code, ESIC code**
- [ ] **Founded year** (`brand.foundedYear`) — drives the "years in operation" figure
- [ ] **Stat counters** (`config.stats`) — guards deployed, years, clients, cities
- [ ] **Branch list** (`config.branches`) — remove cities you do not operate in;
      `x`/`y` are map coordinates, the formula is documented in the file
- [ ] **Three case studies** on `index.html` and `about.html` — real clients, real
      numbers, written permission. There is a `.note` block flagging them in the markup.
- [ ] **Three testimonials** — replace `[Client Company Pvt Ltd]` etc. with real
      names and designations, with permission. Remove the "Verified client" tag
      from any quote you cannot actually verify.
- [ ] **Client logo strip** — swap the four placeholder SVGs for real logos, or
      delete the whole `.logostrip` block. An empty strip beats a fake one.
- [ ] **Service commitments** — the 48-hour deployment, 12-hour replacement and
      4-hour response figures appear throughout. Only keep what you will honour;
      they read as contractual.
- [ ] **Training hours** (40 hours induction) on service pages and `about.html`
- [ ] **Domain** in `robots.txt`, `sitemap.xml` and the `canonical`/`og:` tags in
      `index.html`
- [ ] Add a **privacy policy** page if you collect data through the forms, and link
      it from the consent checkbox on `quote.html` and `careers.html`

---

## Structure

```
├── index.html … portal.html      12 pages, self-contained
├── assets/
│   ├── css/style.css             design system — tokens at the top
│   ├── js/config.js              ← edit this
│   ├── js/site.js                header, counters, modal, accordion, map, branches
│   ├── js/quote.js               multi-step form
│   ├── js/careers.js             application form
│   └── img/                      favicon + OG cover (SVG)
├── server/notify-example.js      reference lead endpoint
├── robots.txt, sitemap.xml
```

**Design tokens** live at the top of `style.css` under `:root` — colours, radii,
shadows and spacing. Change `--gold` and `--ink` to rebrand the whole site.

---

## Notes on the implementation

- **No external requests.** No CDN, no Google Fonts, no tracking. The site renders
  fully offline (the only exception is the optional Maps iframe on `contact.html`).
  This keeps it fast on the patchy mobile connections most of your clients will use.
- **Accessibility.** Keyboard-navigable throughout, visible focus rings, ARIA on
  the accordion / modal / progress bar / map pins, skip link, and
  `prefers-reduced-motion` honoured for all animation.
- **Form validation** is per step, in plain JS, with inline error messages —
  the user is never dropped back to step 1.
- **Print stylesheet** — `company-profile.html` is formatted for A4 output; the
  header, footer, floating buttons and CTA bar are all hidden when printing.
- **The client portal is a preview, not a login.** It describes what is coming and
  invites early-access requests. A non-functional login form would cost more trust
  than it buys.
