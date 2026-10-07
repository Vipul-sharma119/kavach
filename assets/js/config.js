/* ==========================================================================
   KULKAVACH — SITE CONFIGURATION
   --------------------------------------------------------------------------
   This is the ONLY file you need to edit to update business details across
   the whole site. Phone numbers, WhatsApp, PSARA licence, stats, branches and
   the lead-notification endpoint are all injected from here at page load.

   >>> Every value marked  // TODO  is placeholder data. Replace before launch.
   ========================================================================== */

window.KULKAVACH = {

  /* ---------------- Demo mode ----------------
     While `enabled` is true the site shows a slim banner marking every figure
     on the page as sample data. Turn it OFF (false) once the real details
     below are filled in — and delete the <meta name="robots" content="noindex">
     line from the <head> of all 12 pages at the same time (grep for DEMO-ONLY). */
  demo: {
    enabled: false,
    note: 'Design preview — all names, figures, licence numbers and testimonials shown are placeholder samples, pending your details.'
  },

  /* ---------------- Identity ---------------- */
  brand: {
    name: 'Kulkavach',
    legalName: 'Kulkavach Security & Manpower Services',   // TODO: exact registered name
    tagline: 'Security & Manpower',
    foundedYear: 2013,                                      // TODO
    region: 'Madhya Pradesh',
    hq: 'Gwalior'
  },

  /* ---------------- Contact ----------------
     phone/whatsapp: digits only, with country code, no "+" for whatsapp links. */
  contact: {
    phonePrimary:   '+91 7771971515',                      // TODO
    phoneSecondary: '+91 7771971515',                      // TODO
    whatsapp:       '917771971515',                         // TODO digits only, e.g. 919425123456
    email:          'ops@kulkavach.in',                     // TODO
    emailCareers:   'careers@kulkavach.in',                 // TODO
    address: {
      line1: 'Plot 14, City Centre',                        // TODO
      line2: 'Gwalior, Madhya Pradesh 474011',              // TODO
      mapsUrl: 'https://maps.google.com/?q=Gwalior+Madhya+Pradesh'  // TODO exact pin
    },
    hours: [
      { day: 'Office (Mon – Sat)', time: '9:30 AM – 7:00 PM' },
      { day: 'Sunday', time: 'On call' },
      { day: 'Control room', time: '24 × 7 × 365' }
    ],
    responseHours: 4      // used by the "response time" badges + confirmation copy
  },

  /* ---------------- Compliance ----------------
     Shown inside the clickable PSARA verification seal. */
  compliance: {
    psaraNumber: 'SAMPLE — your PSARA licence no.',         // TODO exact licence no.
    psaraIssuer: 'Controlling Authority, Govt. of Madhya Pradesh',
    psaraValidFrom: 'SAMPLE — issue date',                  // TODO
    psaraValidTo:   'SAMPLE — expiry date',                 // TODO
    psaraStatus: 'To be confirmed',
    gstin:  'SAMPLE — your GSTIN',                          // TODO
    pfCode: 'SAMPLE — EPFO establishment code',             // TODO
    esicCode: 'SAMPLE — ESIC code',                         // TODO
    verifyNote: 'Licence copy, EPF/ESIC challans and police-verification records are shared with the quotation on request.'
  },

  /* ---------------- Animated trust counters ---------------- */
  stats: [
    { value: 500, suffix: '+', label: 'Guards deployed' },      // TODO
    { value: 12,  suffix: '+', label: 'Years in operation' },   // TODO
    { value: 80,  suffix: '+', label: 'Clients served' },       // TODO
    { value: 5,   suffix: '',  label: 'Cities covered' }        // TODO
  ],

  /* ---------------- Branches / coverage ----------------
     x,y  = position on the SVG coverage map (viewBox 0 0 600 420)
     labelBelow = draw the city name under the pin instead of above (use it when
            two cities sit close enough that the labels would collide). */
  branches: [
    { id: 'gwalior', name: 'Gwalior', role: 'Head office & control room', x: 285, y: 71,
      phone: '+91 7771971515', staff: '260+ deployed', since: 2013, hq: true,
      areas: 'City Centre, Morar, Thatipur, Maharajpura, DD Nagar, industrial belt' },     // TODO
    { id: 'bhopal', name: 'Bhopal', role: 'Regional branch', x: 237, y: 254,
      phone: '+91 7771971515', staff: '120+ deployed', since: 2017, hq: false,
      areas: 'MP Nagar, Arera Colony, Govindpura, Mandideep' },                            // TODO
    { id: 'indore', name: 'Indore', role: 'Regional branch', x: 141, y: 288, labelBelow: true,
      phone: '+91 7771971515', staff: '90+ deployed', since: 2019, hq: false,
      areas: 'Vijay Nagar, Palasia, Pithampur, SEZ corridor' },                            // TODO
    { id: 'jabalpur', name: 'Jabalpur', role: 'Operations desk', x: 397, y: 259,
      phone: '+91 7771971515', staff: '40+ deployed', since: 2021, hq: false,
      areas: 'Wright Town, Adhartal, Richhai industrial area' },                           // TODO
    { id: 'ujjain', name: 'Ujjain', role: 'Operations desk', x: 136, y: 259,
      phone: '+91 7771971515', staff: '30+ deployed', since: 2022, hq: false,
      areas: 'Freeganj, Nanakheda, Mahakal corridor' }                                     // TODO
  ],

  /* ---------------- Lead handling ----------------
     endpoint: POST target for quote/careers forms (FormData, multipart).
       - Leave '' to use the no-backend fallback (opens a pre-filled WhatsApp
         message + mailto so no lead is ever lost).
       - Set to your own /api/lead route (see server/notify-example.js), or a
         hosted form service (Formspree, Web3Forms, Basin, Google Apps Script).
     See README.md § "Wiring up lead notifications". */
  forms: {
    endpoint: '',                                            // TODO e.g. 'https://api.kulkavach.in/lead'
    fallbackToWhatsApp: true,
    refPrefix: 'KV'
  }
};
