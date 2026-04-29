// ============================================================
// AAM Email Agent — Google Apps Script v5.4
// Changes from v5.3:
//   • Towne East MMR+PDF fast-path: when the weekly email contains
//     the MMR Excel and/or OneSite PDFs (Delinquent & Prepaid,
//     Leasing Activity, Resident Activity), Claude extracts metrics
//     and POSTs directly to /api/towne-east/metrics — no OneSite
//     XLS files required. Dashboard populates immediately.
// ============================================================

const CONFIG = {
  CLAUDE_KEY:              '',  // paste your Anthropic API key here
  BONNY_EMAILS:            ['bonny@wildoakcapital.com', 'bonny.wayman@gmail.com', 'am@venuspartners.com'],
  BOT_INBOX:               'amtaskbonny@gmail.com',
  CHECK_INTERVAL:          15,
  REPORT_SHEET_ID:         '1BVcKGUQMXge8LYvUs4t_a3dXmu55nxvCMT5nFq4kiWo',
  PROCESSED_LABEL:         'aam-processed',
  MAX_FILE_CHARS:          20000,
  SLEEP_MS:                60000,
  THREADS_PER_RUN:         1,
  MODEL:                   'claude-sonnet-4-20250514',
  DASHBOARD_URL:           'https://aligned-dashboard-rip7.vercel.app',
  GROVE_UPLOAD_KEY:        'T8rouQNhmoZ_txV13faboyz6FU-lN0WRJ_FMT-X56ow',
  TOWNE_EAST_UPLOAD_KEY:   'T8rouQNhmoZ_txV13faboyz6FU-lN0WRJ_FMT-X56ow',
};

const PROPS = [
  {id:'woodland-terrace', name:'Woodland Terrace'},
  {id:'woodhaven',        name:'Woodhaven Apartments'},
  {id:'north-park',       name:'North Park Apartments'},
  {id:'towne-east',       name:'Towne East Village'},
  {id:'hall-street',      name:'Hall Street Court'},
  {id:'the-grove',        name:'The Grove'},
  {id:'vaquero',          name:'Vaquero Land Subdivision'},
  {id:'stone-house',      name:'Stone House Hesperus Airbnb'},
  {id:'cactus-corral',    name:'Cactus Corral Cave Creek Airbnb'},
  {id:'rood-5plex',       name:'Rood 5 Plex'},
  {id:'grand-hexaplex',   name:'Grand Hexa Plex'},
  {id:'peter-4plex',      name:'Peter 4 Plex'},
  {id:'general',          name:'General / Other'},
];

const PROP_PEOPLE = {
  'woodland-terrace': ['Bonny','Jalisa','Ramona','Ben','Eric','Shane'],
  'woodhaven':        ['Bonny','Jody','Ashley','Mike','Ben','Eric','Shane'],
  'north-park':       ['Bonny','Caitlyn','Veronica','Ben','Eric','Shane'],
  'towne-east':       ['Bonny','Vanessa','Tamika','Casey','Ebony','Lucian'],
  'hall-street':      ['Bonny','Eric','Chris','Justin','Nick','Corbin'],
  'the-grove':        ['Bonny','Baylee','Eric','Brian','Sara'],
  'vaquero':          ['Bonny','Eric','Shane','Brittany','Jamie V','Jamie J'],
  'stone-house':      ['Bonny','Morgan'],
  'cactus-corral':    ['Bonny','Morgan'],
  'rood-5plex':       ['Bonny','Reece','Dana'],
  'grand-hexaplex':   ['Bonny','Dana'],
  'peter-4plex':      ['Bonny','Dana','Reece'],
  'general':          ['Bonny'],
};
const ALL_PEOPLE = [...new Set(Object.values(PROP_PEOPLE).flat())];

const PROPERTY_ROUTING = [
  { id: 'woodland-terrace', match: ['jalisa@gcmultifamily.com', 'amanda@gcmultifamily.com', 'woodland terrace', 'woodland'] },
  { id: 'north-park',       match: ['caitlyn@gcmultifamily.com', 'northpark.manager@gcmultifamily.com', 'veronica', 'north park'] },
  { id: 'hall-street',      match: ['justin@blakeandalder.com', 'hall street'] },
  { id: 'towne-east',       match: ['sunridge', 'towneeastvillage', 'sunridgeapts', 'towne east', 'te mmr', 'te weekly', 'te month', 'te report'] },
  { id: 'woodhaven',        match: ['implicity', 'woodhaven'] },
  { id: 'the-grove',        match: ['capstone', 'baylee', 'sara.walker@capstone', 'the grove', 'grove'] },
];

// ── Utilities ────────────────────────────────────────────────
function monthKey(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0');
  }
  const s = String(v == null ? '' : v).trim();
  return s.length >= 7 ? s.substring(0, 7) : s;
}

function dateKey(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.getFullYear() + '-' +
           String(v.getMonth() + 1).padStart(2, '0') + '-' +
           String(v.getDate()).padStart(2, '0');
  }
  const s = String(v == null ? '' : v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : dateKey(d);
}

function getProcessedLabel() {
  return GmailApp.getUserLabelByName(CONFIG.PROCESSED_LABEL)
      || GmailApp.createLabel(CONFIG.PROCESSED_LABEL);
}
function markThreadProcessed(thread) {
  thread.addLabel(getProcessedLabel());
  thread.markRead();
}

function detectProperty(from, subject) {
  const hay = (from + ' ' + subject).toLowerCase();
  for (const rule of PROPERTY_ROUTING) {
    for (const kw of rule.match) if (hay.includes(kw.toLowerCase())) return rule.id;
  }
  return null;
}

// ── Shared multipart builder ─────────────────────────────────
// Used by both Grove and Towne East uploads to assemble the raw byte
// payload. Each `field` is {name, att, contentType}.
function buildMultipartPayload(fields) {
  const boundary = '----AAM' + Utilities.getUuid().replace(/-/g, '');
  const crlf = '\r\n';
  const parts = [];

  fields.forEach(function(f) {
    parts.push(Utilities.newBlob(
      '--' + boundary + crlf +
      'Content-Disposition: form-data; name="' + f.name + '"; filename="' + f.att.getName() + '"' + crlf +
      'Content-Type: ' + f.contentType + crlf + crlf
    ).getBytes());
    parts.push(f.att.getBytes());
    parts.push(Utilities.newBlob(crlf).getBytes());
  });
  parts.push(Utilities.newBlob('--' + boundary + '--' + crlf).getBytes());

  let totalLen = 0;
  parts.forEach(function(p) { totalLen += p.length; });
  const body = new Uint8Array(totalLen);
  let offset = 0;
  parts.forEach(function(p) { body.set(p, offset); offset += p.length; });

  return { boundary: boundary, body: body };
}

// ── Grove auto-sync ──────────────────────────────────────────
function isGroveOneSiteBundle(attachments) {
  const found = { rentRoll: null, availability: null, residentBalances: null };
  attachments.forEach(function(att) {
    const raw = att.getName().toLowerCase();
    if (!(raw.endsWith('.xls') || raw.endsWith('.xlsx'))) return;
    const name = raw.replace(/[_+\-\s]+/g, ' ');
    if (!found.rentRoll && (name.includes('rent roll') || name.includes('rentroll') ||
                             name.includes('roll detail'))) {
      found.rentRoll = att; return;
    }
    if (!found.availability && name.includes('avail')) {
      found.availability = att; return;
    }
    if (!found.residentBalances && (name.includes('resident balance') ||
                                    name.includes('fiscal period') ||
                                    /\bbalances?\b/.test(name))) {
      found.residentBalances = att; return;
    }
  });
  return (found.rentRoll && found.availability && found.residentBalances) ? found : null;
}

function uploadGroveSnapshot(bundle) {
  const mp = buildMultipartPayload([
    { name: 'rentRoll',         att: bundle.rentRoll,         contentType: 'application/vnd.ms-excel' },
    { name: 'availability',     att: bundle.availability,     contentType: 'application/vnd.ms-excel' },
    { name: 'residentBalances', att: bundle.residentBalances, contentType: 'application/vnd.ms-excel' },
  ]);
  const resp = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + '/api/grove/snapshot', {
    method: 'post',
    contentType: 'multipart/form-data; boundary=' + mp.boundary,
    payload: mp.body,
    headers: { 'x-upload-key': CONFIG.GROVE_UPLOAD_KEY },
    muteHttpExceptions: true,
  });
  Logger.log('  Grove upload status: ' + resp.getResponseCode());
  if (resp.getResponseCode() >= 300) Logger.log('  Grove upload err: ' + resp.getContentText().slice(0, 300));
  return resp.getResponseCode() < 300;
}

// ── Towne East OneSite auto-sync ─────────────────────────────
// Same 3-file structure as The Grove (OneSite format is identical).
function isTowneEastOneSiteBundle(attachments) {
  const found = { rentRoll: null, availability: null, residentBalances: null };
  attachments.forEach(function(att) {
    const raw = att.getName().toLowerCase();
    if (!(raw.endsWith('.xls') || raw.endsWith('.xlsx'))) return;
    const name = raw.replace(/[_+\-\s]+/g, ' ');
    if (!found.rentRoll && (name.includes('rent roll') || name.includes('rentroll') ||
                             name.includes('roll detail'))) {
      found.rentRoll = att; return;
    }
    if (!found.availability && name.includes('avail')) {
      found.availability = att; return;
    }
    if (!found.residentBalances && (name.includes('resident balance') ||
                                    name.includes('fiscal period') ||
                                    /\bbalances?\b/.test(name))) {
      found.residentBalances = att; return;
    }
  });
  return (found.rentRoll && found.availability && found.residentBalances) ? found : null;
}

// Converts OneSite XLS files to CSV text and uses Claude to extract metrics.
// Avoids sending large binary files to Vercel (which hits payload size limits).
function uploadTowneEastSnapshot(bundle) {
  Logger.log('  [TE XLS] Converting OneSite files to CSV for Claude extraction...');
  const msg = [{ type: 'text', text: tePromptWithDate() }];

  var files = [
    { key: 'rentRoll',         label: 'RENT ROLL' },
    { key: 'availability',     label: 'AVAILABILITY' },
    { key: 'residentBalances', label: 'RESIDENT BALANCES' },
  ];
  files.forEach(function(f) {
    var att = bundle[f.key];
    if (!att) return;
    var csv = xlsxToCsv(attachmentBase64(att), att.getContentType(), att.getName());
    if (csv) msg.push({ type: 'text', text: f.label + ' (CSV):\n' + csv });
    Utilities.sleep(2000);
  });

  var metrics = callClaudeJson(msg, 2500);
  if (!metrics) { Logger.log('  ✗ TE XLS: Claude extraction failed'); return false; }

  var headers = { 'Content-Type': 'application/json' };
  if (CONFIG.TOWNE_EAST_UPLOAD_KEY) headers['x-upload-key'] = CONFIG.TOWNE_EAST_UPLOAD_KEY;
  var resp = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + '/api/towne-east/metrics', {
    method: 'post',
    headers: headers,
    payload: JSON.stringify({ metrics: metrics }),
    muteHttpExceptions: true,
  });
  Logger.log('  [TE XLS] Metrics upload: ' + resp.getResponseCode());
  if (resp.getResponseCode() >= 300) Logger.log('  TE XLS err: ' + resp.getContentText().slice(0, 200));
  return resp.getResponseCode() < 300;
}

// ── Towne East extras auto-sync ──────────────────────────────
// Three supplemental platform reports (all optional; sends whatever arrives):
//   delinquency  — Collections platform CSV  (e.g. delinquency-home-YYYY-MM-DD.csv)
//   maintenance  — Work-order summary CSV     (e.g. maintenance_summary_export_*.csv)
//   leasing      — Leasing-by-channel Excel  (e.g. "Metrics by Channel All Metrics.xlsx")
function isTowneEastExtrasBundle(attachments) {
  const found = { delinquency: null, maintenance: null, leasing: null };
  attachments.forEach(function(att) {
    const raw  = att.getName().toLowerCase();
    const name = raw.replace(/[_+\-\s]+/g, ' ');
    // Delinquency CSV — matches "delinquency home" or "delinquency" standalone CSV
    if (!found.delinquency && (raw.endsWith('.csv') || raw.endsWith('.xlsx')) &&
        (name.includes('delinquency') || name.includes('delinquent'))) {
      found.delinquency = att; return;
    }
    // Maintenance work-order CSV
    if (!found.maintenance && raw.endsWith('.csv') &&
        (name.includes('maintenance') || name.includes('work order') || name.includes('maintenance summary'))) {
      found.maintenance = att; return;
    }
    // Leasing-by-channel Excel (not the rent roll)
    if (!found.leasing && (raw.endsWith('.xlsx') || raw.endsWith('.xls')) &&
        !name.includes('rent roll') && !name.includes('availability') && !name.includes('balance') &&
        (name.includes('metrics by channel') || name.includes('leasing') || name.includes('channel'))) {
      found.leasing = att; return;
    }
  });
  // Return if at least one extras file found (all three fields are optional on the server)
  return (found.delinquency || found.maintenance || found.leasing) ? found : null;
}

function uploadTowneEastExtras(bundle) {
  // Determine content type per file — CSV is text/csv, Excel is vnd.ms-excel
  function ctFor(att) {
    const n = att.getName().toLowerCase();
    if (n.endsWith('.csv'))  return 'text/csv';
    if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    return 'application/vnd.ms-excel';
  }

  const fields = [];
  if (bundle.delinquency) fields.push({ name: 'delinquency', att: bundle.delinquency, contentType: ctFor(bundle.delinquency) });
  if (bundle.maintenance)  fields.push({ name: 'maintenance',  att: bundle.maintenance,  contentType: ctFor(bundle.maintenance)  });
  if (bundle.leasing)      fields.push({ name: 'leasing',      att: bundle.leasing,      contentType: ctFor(bundle.leasing)      });

  if (!fields.length) { Logger.log('  ⊘ No extras fields to upload'); return false; }

  const mp = buildMultipartPayload(fields);
  const headers = {};
  if (CONFIG.TOWNE_EAST_UPLOAD_KEY) headers['x-upload-key'] = CONFIG.TOWNE_EAST_UPLOAD_KEY;
  const resp = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + '/api/towne-east/extras', {
    method: 'post',
    contentType: 'multipart/form-data; boundary=' + mp.boundary,
    payload: mp.body,
    headers: headers,
    muteHttpExceptions: true,
  });
  Logger.log('  Towne East extras upload status: ' + resp.getResponseCode() +
             ' [' + fields.map(function(f){return f.name;}).join(', ') + ']');
  if (resp.getResponseCode() >= 300) Logger.log('  TE extras err: ' + resp.getContentText().slice(0, 300));
  return resp.getResponseCode() < 300;
}

// ── Towne East MMR + PDF fast-path ──────────────────────────
// Detects the weekly Sunridge email that contains the MMR Excel
// and/or the three OneSite PDFs (delinquent, leasing, resident).
// Claude reads all of them and extracts TowneEastMetrics JSON
// which is POSTed to /api/towne-east/metrics.
function isTowneEastMMRBundle(attachments) {
  const found = { mmr: null, delinquency: null, leasingActivity: null, residentActivity: null };
  attachments.forEach(function(att) {
    const raw  = att.getName().toLowerCase();
    const name = raw.replace(/[_+\-\s]+/g, ' ');
    const mime = att.getContentType() || '';
    if (!found.mmr && (raw.endsWith('.xlsx') || raw.endsWith('.xls')) &&
        (name.includes('mmr') || name.includes('monthly management') || name.includes('weekly agenda') || name.includes('te mmr'))) {
      found.mmr = att; return;
    }
    if (!found.delinquency && mime.includes('pdf') &&
        (name.includes('delinquent') || name.includes('delinquency') || name.includes('prepaid'))) {
      found.delinquency = att; return;
    }
    if (!found.leasingActivity && mime.includes('pdf') &&
        (name.includes('leasing activ') || name.includes('leasing activity'))) {
      found.leasingActivity = att; return;
    }
    if (!found.residentActivity && mime.includes('pdf') &&
        (name.includes('resident activ') || name.includes('resident activity'))) {
      found.residentActivity = att; return;
    }
  });
  return (found.mmr || found.delinquency) ? found : null;
}

var TE_METRICS_PROMPT =
  'You are extracting Towne East Village (100-unit, Converse TX) dashboard metrics from the attached reports.\n\n' +
  'Sources may include: MMR Excel (occupancy, collections), Rent Roll CSV (unit status, lease rent, market rent),\n' +
  'Availability CSV (vacant unit details), Resident Balances CSV (payments/collections),\n' +
  'Delinquent and Prepaid PDF (delinquency), Leasing Activity PDF (prospects/leases),\n' +
  'Resident Activity PDF (move-ins/outs/NTVs/renewals).\n\n' +
  'Return ONLY the JSON below (no markdown). Use 0 or "" for any field not found.\n\n' +
  'OCCUPANCY RULES (from Rent Roll):\n' +
  '- occupiedCount = rows where status = "Occupied" (not NTV)\n' +
  '- occupiedNTVCount = rows where status = "Occupied - NTV" or "Notice to Vacate"\n' +
  '- vacantCount = rows where status = "Vacant"\n' +
  '- physicalOccupancyPct = (occupiedCount + occupiedNTVCount) / 100 * 100\n' +
  '- gpr = SUM of market rent for ALL 100 units (including vacant)\n' +
  '- totalLeaseRent = SUM of lease/contract rent for Occupied + NTV units only\n' +
  '- economicOccupancyPct = totalLeaseRent / gpr * 100\n\n' +
  'COLLECTIONS RULES (from Resident Balances or MMR):\n' +
  '- totalCharged = sum of "Lease Charges" or "Current Charges" column for current residents\n' +
  '- totalCollected = sum of "Total Credits" or "Payments Received" or "Cash Receipts" column — actual money received this period\n' +
  '- collectionRatePct = totalCollected / totalCharged * 100\n\n' +
  'LEASING RULES (from Rent Roll — use TODAY\'S DATE for all date math):\n' +
  '- expiring30d = count of Occupied/NTV units where leaseEnd is between today and today+30 days\n' +
  '- expiring60d = count where leaseEnd is between today and today+60 days\n' +
  '- expiring90d = count where leaseEnd is between today and today+90 days\n' +
  '- monthToMonthCount = count of Occupied/NTV units where leaseEnd is BEFORE today (expired, no renewal)\n' +
  '- signedLeasesMTD = count of units where leaseStart falls in the CURRENT calendar month and year\n' +
  '- moveOutsNTVCount = same as occupiedNTVCount\n' +
  '- leaseExpirationByMonth = array of 6 objects for the next 6 calendar months (starting this month):\n' +
  '  each object: { "month": "Mon YYYY", "expiring": N, "ntv": N, "mtm": N }\n' +
  '  expiring = units with leaseEnd in that month; ntv = NTV units expiring that month; mtm = current month MTM count only\n' +
  '- moveOutsThisMonth = NTV units whose leaseEnd falls in the current calendar month\n' +
  '- leaseStartsThisMonth = units whose leaseStart falls in the current calendar month\n\n' +
  'DELINQUENCY RULES:\n' +
  '- delinquentBalance = "Net Delinquent" from the grand totals row\n' +
  '- priorPeriodBalance = "Beginning Balance" grand total\n' +
  '- newDelinquencyThisPeriod = delinquentBalance - priorPeriodBalance\n' +
  '- delinquentCount = resident count from the Resident Count row (the delinquent column)\n' +
  '- topDelinquents = top 5 residents by net balance (positive amounts only, include unit number)\n\n' +
  '{"asOf":"YYYY-MM-DD","unitCount":100,"occupiedCount":0,"occupiedNTVCount":0,"vacantCount":0,' +
  '"physicalOccupancyPct":0,"leasedOccupancyPct":0,"gpr":0,"totalLeaseRent":0,"economicOccupancyPct":0,' +
  '"totalCharged":0,"totalCollected":0,"collectionRatePct":0,' +
  '"delinquentBalance":0,"priorPeriodBalance":0,"newDelinquencyThisPeriod":0,"delinquentCount":0,' +
  '"topDelinquents":[{"unit":"","name":"","amount":0}],' +
  '"moveOutsNTVCount":0,"monthToMonthCount":0,"signedLeasesMTD":0,' +
  '"expiring30d":0,"expiring60d":0,"expiring90d":0,"leaseExpirationByMonth":[],' +
  '"moveOutsThisMonth":[{"unit":"","residentName":"","moveOutDate":""}],' +
  '"leaseStartsThisMonth":[{"unit":"","residentName":"","leaseStart":""}],' +
  '"vacantTotalCount":0,"notReadyCount":0,"rentReadyCount":0,"inProcessCount":0,"notStartedCount":0}';

function tePromptWithDate() {
  var today = Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
  return 'TODAY\'S DATE: ' + today + '\n\n' + TE_METRICS_PROMPT;
}

function uploadTowneEastFromMMR(bundle) {
  Logger.log('  [TE MMR] Extracting metrics from MMR+PDF bundle via Claude...');
  const msg = [{ type: 'text', text: tePromptWithDate() }];

  // MMR Excel → convert to CSV so Claude can read it as text
  if (bundle.mmr) {
    const csv = xlsxToCsv(attachmentBase64(bundle.mmr), bundle.mmr.getContentType(), bundle.mmr.getName());
    if (csv) msg.push({ type: 'text', text: 'MMR EXCEL (CSV):\n' + csv });
  }
  // PDFs sent as native documents
  if (bundle.delinquency) {
    msg.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: attachmentBase64(bundle.delinquency) } });
    msg.push({ type: 'text', text: 'Above: Delinquent and Prepaid report' });
  }
  if (bundle.leasingActivity) {
    msg.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: attachmentBase64(bundle.leasingActivity) } });
    msg.push({ type: 'text', text: 'Above: Leasing Activity Detail' });
  }
  if (bundle.residentActivity) {
    msg.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: attachmentBase64(bundle.residentActivity) } });
    msg.push({ type: 'text', text: 'Above: Resident Activity report' });
  }

  const metrics = callClaudeJson(msg, 2500);
  if (!metrics) { Logger.log('  ✗ TE MMR: Claude extraction failed'); return false; }

  const headers = { 'Content-Type': 'application/json' };
  if (CONFIG.TOWNE_EAST_UPLOAD_KEY) headers['x-upload-key'] = CONFIG.TOWNE_EAST_UPLOAD_KEY;
  const resp = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + '/api/towne-east/metrics', {
    method: 'post',
    headers: headers,
    payload: JSON.stringify({ metrics: metrics }),
    muteHttpExceptions: true,
  });
  Logger.log('  [TE MMR] Metrics upload: ' + resp.getResponseCode());
  if (resp.getResponseCode() >= 300) Logger.log('  TE metrics err: ' + resp.getContentText().slice(0, 300));
  return resp.getResponseCode() < 300;
}

// ── Attachment helpers ───────────────────────────────────────
function attachmentBase64(att) { return Utilities.base64Encode(att.getBytes()); }

function attachmentToText(att) {
  const mime = att.getContentType();
  const name = att.getName();
  const b64  = attachmentBase64(att);
  if (mime === 'application/pdf') return { kind: 'pdf', b64, name };
  if (mime === 'text/csv' || mime === 'text/plain') {
    const bytes = Utilities.base64Decode(b64);
    return { kind: 'text', text: Utilities.newBlob(bytes).getDataAsString().substring(0, CONFIG.MAX_FILE_CHARS), name };
  }
  const csv = xlsxToCsv(b64, mime, name);
  if (csv && csv.length > 30) return { kind: 'text', text: csv, name };
  return null;
}

function xlsxToCsv(base64Data, mimeType, fileName) {
  try {
    const bytes = Utilities.base64Decode(base64Data);
    const blob  = Utilities.newBlob(bytes, mimeType, fileName || 'temp.xlsx');
    const file  = DriveApp.createFile(blob);
    const resource = { title: 'aam_tmp_' + Date.now(), mimeType: 'application/vnd.google-apps.spreadsheet' };
    const converted = Drive.Files.copy(resource, file.getId());
    Utilities.sleep(3000);
    const resp = UrlFetchApp.fetch(
      'https://docs.google.com/spreadsheets/d/' + converted.id + '/export?format=csv',
      { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true }
    );
    try { DriveApp.getFileById(file.getId()).setTrashed(true); } catch(e) {}
    try { DriveApp.getFileById(converted.id).setTrashed(true); } catch(e) {}
    if (resp.getResponseCode() !== 200) return null;
    return resp.getContentText().substring(0, CONFIG.MAX_FILE_CHARS);
  } catch(e) { Logger.log('  xlsx→CSV error: ' + e.message); return null; }
}

// ── Renovation tracker (reads Google Sheet directly) ────────
var RENOVATION_SHEET_ID = '1Jt9WIaON5joUPNwduptvgRb3PyjyZmsioGGP6KJudh8';
var RENOVATION_GID      = 546291258;

function readRenovationSheet() {
  try {
    var ss = SpreadsheetApp.openById(RENOVATION_SHEET_ID);
    var sheet = null;
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === RENOVATION_GID) { sheet = sheets[i]; break; }
    }
    if (!sheet) sheet = sheets[0];

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return null;

    var headers = data[0].map(function(h) { return String(h).trim(); });
    var today = new Date();
    var tz = 'America/Chicago';

    function getCol(row, name) {
      var idx = headers.indexOf(name);
      return idx >= 0 ? row[idx] : '';
    }
    function parseAmt(v) {
      var n = parseFloat(String(v || '0').replace(/[$,\s]/g, ''));
      return isNaN(n) ? 0 : n;
    }
    function fmtDate(d) {
      if (!d) return '';
      var dt = d instanceof Date ? d : new Date(d);
      return isNaN(dt.getTime()) ? '' : Utilities.formatDate(dt, tz, 'yyyy-MM-dd');
    }

    var units = [];
    var totalBudget = 0, totalSpend = 0;
    var completedDays = [], completedCount = 0, inProgressCount = 0, gettingBidsCount = 0;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var unit = String(getCol(row, 'Unit') || '').trim();
      if (!unit) continue;
      var status = String(getCol(row, 'Status') || '').trim();
      if (!status || status === 'Not being renovated') continue;

      var budget  = parseAmt(getCol(row, 'Budget'));
      var spend   = parseAmt(getCol(row, 'Actual Final Spend'));
      var moveOut = getCol(row, 'Move Out Date');
      var startDt = getCol(row, 'Start Date');
      var completion = getCol(row, 'Actual Completion Date');

      // Days = startDate (or moveOut) → completionDate (or today)
      var refStart = startDt || moveOut;
      var refEnd   = completion || today;
      var days = 0;
      if (refStart) {
        var s = refStart instanceof Date ? refStart : new Date(refStart);
        var e = refEnd   instanceof Date ? refEnd   : new Date(refEnd);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          days = Math.max(0, Math.round((e.getTime() - s.getTime()) / 86400000));
        }
      }
      // Use sheet's own Days column if filled
      var daysCol = parseFloat(String(getCol(row, 'Days Under Construction') || '')) || 0;
      if (daysCol > 0) days = daysCol;

      totalBudget += budget;
      totalSpend  += spend;
      if (status === 'Complete')       { completedCount++;    if (days > 0) completedDays.push(days); }
      else if (status === 'In Progress') inProgressCount++;
      else if (status === 'Getting Bids') gettingBidsCount++;

      units.push({
        unit: unit,
        floorplan: String(getCol(row, 'Floorplan') || ''),
        budget: budget,
        moveOutDate: fmtDate(moveOut),
        startDate: fmtDate(startDt),
        completionDate: fmtDate(completion),
        actualSpend: spend,
        daysUnderConstruction: days,
        status: status,
        notes: String(getCol(row, 'Notes') || ''),
      });
    }

    var avgDays = completedDays.length > 0
      ? Math.round(completedDays.reduce(function(s,d){return s+d;},0) / completedDays.length)
      : 0;

    return {
      units: units,
      totalBudget: totalBudget,
      totalSpend: totalSpend,
      avgDaysCompleted: avgDays,
      budgetDays: 14,
      completedCount: completedCount,
      inProgressCount: inProgressCount,
      gettingBidsCount: gettingBidsCount,
      updatedAt: new Date().toISOString(),
    };
  } catch(e) { Logger.log('  [Renovation] Sheet read error: ' + e.message); return null; }
}

function uploadTowneEastRenovation(renovation) {
  var headers = { 'Content-Type': 'application/json' };
  if (CONFIG.TOWNE_EAST_UPLOAD_KEY) headers['x-upload-key'] = CONFIG.TOWNE_EAST_UPLOAD_KEY;
  var resp = UrlFetchApp.fetch(CONFIG.DASHBOARD_URL + '/api/towne-east/extras', {
    method: 'post', headers: headers,
    payload: JSON.stringify({ renovation: renovation }),
    muteHttpExceptions: true,
  });
  Logger.log('  [TE Renovation] Upload: ' + resp.getResponseCode());
  if (resp.getResponseCode() >= 300) Logger.log('  Renovation err: ' + resp.getContentText().slice(0, 200));
  return resp.getResponseCode() < 300;
}

// ── Main entry ───────────────────────────────────────────────
function checkNewEmails() {
  Logger.log('=== AAM Email Agent v5.4 starting ===');

  const rawThreads = GmailApp.search('is:unread', 0, 10);
  Logger.log('Unread threads: ' + rawThreads.length);

  const threads = rawThreads.filter(function(t) {
    const labeled = t.getLabels().some(function(l) { return l.getName() === CONFIG.PROCESSED_LABEL; });
    if (labeled) {
      const msgs = t.getMessages();
      Logger.log('  ⊘ Already processed (skipping): ' + msgs[msgs.length - 1].getSubject());
    }
    return !labeled;
  }).slice(0, CONFIG.THREADS_PER_RUN);

  if (!threads.length) { Logger.log('No new unprocessed emails.'); return; }
  Logger.log('Processing: ' + threads.length + ' thread(s)');

  threads.forEach(function(thread) {
    try {
      const messages = thread.getMessages();
      const latest   = messages[messages.length - 1];
      const subject  = latest.getSubject() || '(no subject)';
      const from     = latest.getFrom();
      const to       = latest.getTo();
      const body     = latest.getPlainBody() || '';
      const attList  = latest.getAttachments();
      const toLower  = (to || '').toLowerCase();
      const isToBot  = toLower.includes(CONFIG.BOT_INBOX);
      const hasAtts  = attList.some(function(a) {
        const n = a.getName().toLowerCase();
        return n.endsWith('.pdf') || n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv');
      });

      markThreadProcessed(thread);

      if (isToBot && hasAtts) {
        const propId = detectProperty(from, subject);

        // ── Grove fast-path ──────────────────────────────────
        if (propId === 'the-grove') {
          const groveBundle = isGroveOneSiteBundle(attList);
          if (groveBundle) {
            Logger.log('[GROVE AUTO-SYNC] ' + subject);
            const ok = uploadGroveSnapshot(groveBundle);
            Logger.log(ok ? '  ✓ Grove snapshot uploaded' : '  ✗ Grove snapshot failed');
            return; // done — no Claude needed
          }
          // Grove email but not a clean 3-file bundle → fall through to processReport
        }

        // ── Towne East fast-path ─────────────────────────────
        // A single email may contain both the OneSite bundle AND the extras
        // reports (or just one). We attempt both and log each result.
        if (propId === 'towne-east') {
          const teOneSite = isTowneEastOneSiteBundle(attList);
          const teExtras  = isTowneEastExtrasBundle(attList);
          const teMMR     = isTowneEastMMRBundle(attList); // always check, even if XLS present

          if (teOneSite || teExtras || teMMR) {
            Logger.log('[TOWNE EAST AUTO-SYNC] ' + subject);
            // ① OneSite XLS bundle — wrapped in try/catch so errors don't block ② and ③
            if (teOneSite) {
              try {
                const ok = uploadTowneEastSnapshot(teOneSite);
                Logger.log(ok ? '  ✓ TE snapshot uploaded' : '  ✗ TE snapshot failed');
              } catch(e) { Logger.log('  ✗ TE snapshot error: ' + e.message); }
            }
            // ② Platform extras CSVs
            if (teExtras) {
              try {
                Utilities.sleep(2000);
                const ok = uploadTowneEastExtras(teExtras);
                Logger.log(ok ? '  ✓ TE extras uploaded' : '  ✗ TE extras failed');
              } catch(e) { Logger.log('  ✗ TE extras error: ' + e.message); }
            }
            // ③ MMR + PDF fast-path — always runs when MMR/PDFs are present
            if (teMMR) {
              try {
                const ok = uploadTowneEastFromMMR(teMMR);
                Logger.log(ok ? '  ✓ TE MMR metrics uploaded' : '  ✗ TE MMR metrics failed');
              } catch(e) { Logger.log('  ✗ TE MMR error: ' + e.message); }
            }
            // ④ Renovation tracker — always refresh from Google Sheet
            try {
              const renovation = readRenovationSheet();
              if (renovation) {
                const ok = uploadTowneEastRenovation(renovation);
                Logger.log(ok ? '  ✓ Renovation data uploaded' : '  ✗ Renovation upload failed');
              }
            } catch(e) { Logger.log('  ✗ Renovation error: ' + e.message); }
            return; // done
          }
          // Towne East email but no fast-path files → fall through to processReport
        }

        // ── General report pipeline (all other properties) ───
        Logger.log('[REPORT] ' + subject);
        processReport(latest, subject, from, body, attList);

      } else if (isOutboundDelegation(from, to)) {
        Logger.log('[DELEGATION] ' + subject);
        processDelegation(subject, from, to, body);
      } else {
        Logger.log('[INBOUND] ' + subject);
        processInbound(subject, from, body);
      }
    } catch(e) { Logger.log('  ✗ Thread failed: ' + e.message); }
  });

  Logger.log('=== Done ===');
}

// ── Report pipeline: triage → snapshot → financials ─────────
function processReport(message, subject, from, body, attachments) {
  const filenames = attachments.map(function(a) { return a.getName(); });
  const emailDate = message.getDate();
  Logger.log('  Triaging — ' + filenames.length + ' attachments');

  const plan = triageEmail(subject, from, body, filenames, emailDate);
  if (!plan) { Logger.log('  ✗ Triage failed'); return; }
  if (plan.skip) { Logger.log('  ⊘ Triage says skip: ' + plan.reason); return; }
  if (!plan.report_date) plan.report_date = dateKey(emailDate);

  Logger.log('  Plan: property=' + plan.property_id + ' date=' + plan.report_date +
             ' weekly_source=' + plan.weekly_source + ' financial_source=' + plan.financial_source);

  Utilities.sleep(CONFIG.SLEEP_MS);

  const snapContent = buildSourceContent(plan.weekly_source, body, attachments);
  if (snapContent) {
    const snap = extractSnapshot(plan, body, snapContent);
    if (snap && !snap.skip) writeSnapshot(plan, snap, subject, from);
    else Logger.log('  ✗ Snapshot extraction empty');
    Utilities.sleep(CONFIG.SLEEP_MS);
  }

  if (plan.financial_source && plan.financial_source !== 'null' && plan.financial_source !== 'body') {
    const finContent = buildSourceContent(plan.financial_source, body, attachments);
    if (finContent && finContent.docs.length) {
      const fin = extractFinancials(plan, finContent);
      if (fin && !fin.skip) writeFinancialsMonthly(plan, fin, subject, from);
      else Logger.log('  ✗ Financials extraction empty');
      Utilities.sleep(CONFIG.SLEEP_MS);
    }
  }
}

function buildSourceContent(sourceSpec, body, attachments) {
  if (!sourceSpec || sourceSpec === 'null') return null;
  const docs = [];
  let bodyText = '';
  if (sourceSpec === 'body') {
    bodyText = body.substring(0, CONFIG.MAX_FILE_CHARS);
  } else {
    const wanted = sourceSpec.split(',').map(function(s) { return s.trim().toLowerCase(); });
    attachments.forEach(function(att) {
      const name = att.getName().toLowerCase();
      if (wanted.some(function(w) { return w && (name === w || name.includes(w) || w.includes(name)); })) {
        const conv = attachmentToText(att);
        if (conv) docs.push(conv);
      }
    });
  }
  return { body: bodyText, docs };
}

// ── Claude calls ─────────────────────────────────────────────
function callClaudeJson(messageContent, maxTokens) {
  try {
    const resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method:  'post',
      headers: { 'Content-Type':'application/json', 'x-api-key': CONFIG.CLAUDE_KEY, 'anthropic-version':'2023-06-01' },
      payload: JSON.stringify({ model: CONFIG.MODEL, max_tokens: maxTokens || 1500, messages: [{ role:'user', content: messageContent }] }),
      muteHttpExceptions: true,
    });
    if (resp.getResponseCode() !== 200) { Logger.log('Claude err: ' + resp.getContentText().slice(0, 300)); return null; }
    const data = JSON.parse(resp.getContentText());
    const text = data.content.filter(function(c){return c.type==='text';}).map(function(c){return c.text;}).join('');
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } catch(e) { Logger.log('Claude err: ' + e.message); return null; }
}

function triageEmail(subject, from, body, filenames, emailDate) {
  const emailDateStr = dateKey(emailDate);
  const prompt =
    'You are triaging a property-management email for an automated asset-management pipeline.\n\n' +
    'Known properties: ' + PROPS.map(function(p){return p.id+': '+p.name;}).join(', ') + '\n\n' +
    'Email:\nFrom: ' + from + '\nSubject: ' + subject + '\nSent: ' + emailDateStr + '\n' +
    'Body (first 2000 chars): ' + (body || '(empty)').substring(0, 2000) + '\n' +
    'Attachments: ' + JSON.stringify(filenames) + '\n\n' +
    'Determine:\n' +
    '- property_id: match sender/subject/body to one known property (or "unknown")\n' +
    '- report_date: "YYYY-MM-DD" — "as of" date of the data if visible, otherwise email send date (' + emailDateStr + ')\n' +
    '- report_month: "YYYY-MM" if financial statements are present, else null\n' +
    '- profile: "body_first" / "single_source" / "multi_attachment" / "rent_roll_only"\n' +
    '- weekly_source: where leasing/occupancy KPIs live — "body", a filename, comma-separated filenames, or null\n' +
    '- financial_source: where monthly P&L lives — filename or null\n' +
    '- skip: true only if clearly not a property report\n\n' +
    'NOISE filenames to NEVER list in sources:\n' +
    '- tenant_tickler, concessions (standalone), bank_deposit_summary, resident_activity,\n' +
    '  aged_payables_summary alone, trust_account_balance alone, unit_vacancy_detail,\n' +
    '  leasing_activity (include only if no rent_roll exists)\n\n' +
    'STRICT RULE for weekly_source:\n' +
    '- Use "body" ONLY if the body contains EXPLICIT NUMERIC KPIs like "Occupancy 93.80%", "Vacant 5", "NTV 3", "Collected $65,681", "Preleased 5". Labeled percentages and dollar amounts — not prose.\n' +
    '- Narrative-only bodies (project updates, focus areas, resident events, marketing notes) with NO numeric KPIs do NOT qualify. Use the MMR/Weekly Agenda xlsx instead.\n' +
    '- Filename priority when body is not suitable:\n' +
    '  1. "mmr" / "monthly_management_report" / "weekly_agenda" — single comprehensive xlsx (strongest preference)\n' +
    '  2. "weekly_report" / "call_prep" / "rent_roll_detail" / "rent_roll"\n' +
    '  3. Comma-separated list of per-metric files when no single source exists\n' +
    '- For rent-roll-only auto-feeds (no body), weekly_source = the rent roll filename\n\n' +
    'Training examples from real PM emails:\n' +
    '- GC/Caitlyn "Call Prep Report": body has "Occupancy 93.80%, Vacant 5, NTV 3, Collected $65,681" → weekly_source="body" ✓\n' +
    '- Sunridge/TE "MMR": body is narrative only ("Gaining Traffic... Pool resurfacing... Building 6 sheetrock") → weekly_source="TE MMR 2026 4.13.26.xlsx" (NOT "body" — narrative alone is never enough)\n' +
    '- Capstone/Grove "Weekly Agenda": body has single headline ("Great week, 3 new leases!") → weekly_source="The Grove Weekly Agenda 04.17.2026.xlsx"\n' +
    '- AppFolio daily auto-feed: empty body, single rent_roll.xlsx → weekly_source="rent_roll.xlsx"\n\n' +
    'Priority for financial_source:\n' +
    '- "income_statement_12_month" / "t12" / "income_statement" / "p_and_l" / "profit_loss"\n' +
    '- "annual_budget_comparative" / "budget_vs_actual"\n' +
    '- "mmr" / "monthly_management_report" (often has P&L inside)\n' +
    '- null if none present\n\n' +
    'Respond ONLY with JSON:\n' +
    '{"skip":false,"property_id":"","report_date":"YYYY-MM-DD","report_month":"","profile":"","weekly_source":"","financial_source":"","reason":""}';

  return callClaudeJson([{ type:'text', text: prompt }], 500);
}

function extractSnapshot(plan, body, content) {
  const propName = (PROPS.filter(function(p){return p.id===plan.property_id;})[0] || {}).name || plan.property_id;
  const msg = [];
  msg.push({ type:'text', text:
    'You are a multifamily analyst extracting a property snapshot for asset-management tracking.\n\n' +
    'Property: ' + plan.property_id + ' (' + propName + ')\n' +
    'Report date: ' + plan.report_date + '\n\n' +
    'Extract from the email body first (verbatim where PM provides KPIs); use attachments for richer detail (especially rent roll for lease expirations, economic occupancy, loss to lease, MTOM).\n' +
    'If a field is not derivable from the sources, return "" or 0 — DO NOT GUESS.\n\n' +
    '# Definitions:\n' +
    '- physical_occupancy_pct: occupied_units / total_units (0-1 scale)\n' +
    '- projected_occupancy_pct: (occupied − ntv + preleased) / total_units — forward-looking\n' +
    '- economic_occupancy_pct: actual_rent / market_rent — catches loss-to-lease\n' +
    '- loss_to_lease_amt: market_rent_total − actual_rent_total\n' +
    '- vacant_ready_units: vacants move-in ready (not in turn)\n' +
    '- preleased_units: signed leases not yet moved in\n' +
    '- ntv_units: tenants on notice to vacate\n' +
    '- leases_expiring_30/60/90d: count of leases with end date in next N days (excluding MTOM)\n' +
    '- mtom_units: month-to-month leases\n' +
    '- close_pct: leases_signed_week / visits (0-1 scale)\n\n' +
    '# Narrative capture (verbatim from email body when available):\n' +
    '- pm_focus, active_projects, upcoming_events, current_special\n\n' +
    '# Return JSON only (no markdown), use "" or 0 for unknown:\n' +
    '{"physical_occupancy_pct":0,"projected_occupancy_pct":0,"economic_occupancy_pct":0,' +
    '"total_units":0,"occupied_units":0,"vacant_units":0,"vacant_ready_units":0,' +
    '"preleased_units":0,"preleased_move_in_dates":"","ntv_units":0,"ntv_notice_dates":"",' +
    '"move_ins_mtd":0,"move_outs_mtd":0,"evictions_in_progress":0,' +
    '"leases_expiring_30d":0,"leases_expiring_60d":0,"leases_expiring_90d":0,' +
    '"loss_to_lease_amt":0,"avg_market_rent":0,"avg_actual_rent":0,"mtom_units":0,' +
    '"new_prospects":0,"visits":0,"leases_signed_week":0,"close_pct":0,"top_ad_source":"",' +
    '"collected_mtd":0,"expected_mtd":0,"delinquent_total":0,' +
    '"delinq_0_30":0,"delinq_31_60":0,"delinq_61_90":0,"delinq_90_plus":0,' +
    '"largest_delinquent_unit":"","largest_delinquent_amt":0,' +
    '"current_special":"","concessions_mtd":0,' +
    '"trust_balance":0,"aged_payables_total":0,' +
    '"pm_focus":"","active_projects":"","upcoming_events":"","notes":""}\n\n' +
    'Email body:\n' + (body || '(empty)').substring(0, 3000) + '\n'
  });

  if (content.body && content.body !== body.substring(0, 3000)) {
    msg.push({ type:'text', text: 'Body (source-marked):\n' + content.body });
  }
  content.docs.forEach(function(d) {
    if (d.kind === 'pdf') {
      msg.push({ type:'document', source: { type:'base64', media_type:'application/pdf', data: d.b64 } });
      msg.push({ type:'text', text: 'PDF attached: ' + d.name });
    } else {
      msg.push({ type:'text', text: 'Attachment "' + d.name + '" (CSV):\n' + d.text });
    }
  });
  return callClaudeJson(msg, 2000);
}

function extractFinancials(plan, content) {
  const propName = (PROPS.filter(function(p){return p.id===plan.property_id;})[0] || {}).name || plan.property_id;
  const msg = [];
  msg.push({ type:'text', text:
    'You are a multifamily analyst extracting a monthly P&L snapshot.\n\n' +
    'Property: ' + plan.property_id + ' (' + propName + ')\n' +
    'Hinted report_month: ' + plan.report_month + '\n\n' +
    'If T12 income statement: extract MOST RECENT COMPLETE month (not total column).\n' +
    'If budget-vs-actual: extract actuals AND budget columns.\n' +
    'Compute: egi = gpr − vacancy_loss − concessions − bad_debt + other_income; total_expenses = sum of opex; noi = egi − total_expenses; cash_flow = noi − debt_service; expense_ratio = total_expenses / egi; noi_margin_pct = noi / egi.\n\n' +
    'Return JSON only, use 0 or "" for unknown:\n' +
    '{"report_month":"YYYY-MM","gross_potential_rent":0,"vacancy_loss":0,"concessions":0,"bad_debt":0,"other_income":0,"egi":0,' +
    '"repairs_maintenance":0,"management_fee":0,"insurance":0,"property_tax":0,"utilities":0,"admin":0,"payroll":0,"other_expenses":0,"total_expenses":0,' +
    '"noi":0,"noi_margin_pct":0,"expense_ratio":0,"debt_service":0,"cash_flow":0,"dscr":0,' +
    '"budget_noi":0,"budget_variance_amt":0,"budget_variance_pct":0,' +
    '"prior_year_noi":0,"yoy_variance_pct":0,"ytd_noi":0,"notes":""}\n'
  });

  content.docs.forEach(function(d) {
    if (d.kind === 'pdf') {
      msg.push({ type:'document', source: { type:'base64', media_type:'application/pdf', data: d.b64 } });
      msg.push({ type:'text', text: 'Source PDF: ' + d.name });
    } else {
      msg.push({ type:'text', text: 'Source "' + d.name + '" (CSV):\n' + d.text });
    }
  });
  return callClaudeJson(msg, 1500);
}

// ── Writes ───────────────────────────────────────────────────
function writeSnapshot(plan, w, subject, from) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.REPORT_SHEET_ID);
    let sheet = ss.getSheetByName('snapshots');
    if (!sheet) { sheet = ss.insertSheet('snapshots'); addHeaders(sheet, 'snapshots'); sheet.setFrozenRows(1); }

    const propName = (PROPS.filter(function(p){return p.id===plan.property_id;})[0] || {}).name || plan.property_id;
    const rd = dateKey(plan.report_date) || dateKey(new Date());

    const all = sheet.getDataRange().getValues();
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][0]) === String(plan.property_id) &&
          dateKey(all[i][2]) === rd &&
          String(all[i][46]) === String(subject)) {
        Logger.log('  ⚠ Duplicate snapshot ' + plan.property_id + ' ' + rd + ' — skipping');
        return;
      }
    }

    sheet.appendRow([
      plan.property_id, propName, rd, new Date(),
      w.physical_occupancy_pct||0, w.projected_occupancy_pct||0, w.economic_occupancy_pct||0,
      w.total_units||0, w.occupied_units||0, w.vacant_units||0, w.vacant_ready_units||0,
      w.preleased_units||0, w.preleased_move_in_dates||'', w.ntv_units||0, w.ntv_notice_dates||'',
      w.move_ins_mtd||0, w.move_outs_mtd||0, w.evictions_in_progress||0,
      w.leases_expiring_30d||0, w.leases_expiring_60d||0, w.leases_expiring_90d||0,
      w.loss_to_lease_amt||0, w.avg_market_rent||0, w.avg_actual_rent||0, w.mtom_units||0,
      w.new_prospects||0, w.visits||0, w.leases_signed_week||0, w.close_pct||0, w.top_ad_source||'',
      w.collected_mtd||0, w.expected_mtd||0, w.delinquent_total||0,
      w.delinq_0_30||0, w.delinq_31_60||0, w.delinq_61_90||0, w.delinq_90_plus||0,
      w.largest_delinquent_unit||'', w.largest_delinquent_amt||0,
      w.current_special||'', w.concessions_mtd||0,
      w.trust_balance||0, w.aged_payables_total||0,
      w.pm_focus||'', w.active_projects||'', w.upcoming_events||'', w.notes||'',
      subject, from
    ]);
    SpreadsheetApp.flush();
    Logger.log('  ✓ Wrote snapshot: ' + plan.property_id + ' ' + rd);
  } catch(e) { Logger.log('snapshot write err: ' + e.message); }
}

function writeFinancialsMonthly(plan, f, subject, from) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.REPORT_SHEET_ID);
    let sheet = ss.getSheetByName('financials_monthly');
    if (!sheet) { sheet = ss.insertSheet('financials_monthly'); addHeaders(sheet, 'financials_monthly'); sheet.setFrozenRows(1); }

    const propName = (PROPS.filter(function(p){return p.id===plan.property_id;})[0] || {}).name || plan.property_id;
    const rm = monthKey(f.report_month || plan.report_month);

    const all = sheet.getDataRange().getValues();
    for (let i = 1; i < all.length; i++) {
      if (String(all[i][0]) === String(plan.property_id) && monthKey(all[i][2]) === rm) {
        Logger.log('  ⚠ Duplicate financials ' + plan.property_id + ' ' + rm + ' — skipping');
        return;
      }
    }

    sheet.appendRow([
      plan.property_id, propName, rm, new Date(),
      f.gross_potential_rent||0, f.vacancy_loss||0, f.concessions||0, f.bad_debt||0, f.other_income||0, f.egi||0,
      f.repairs_maintenance||0, f.management_fee||0, f.insurance||0, f.property_tax||0,
      f.utilities||0, f.admin||0, f.payroll||0, f.other_expenses||0, f.total_expenses||0,
      f.noi||0, f.noi_margin_pct||0, f.expense_ratio||0, f.debt_service||0, f.cash_flow||0, f.dscr||0,
      f.budget_noi||0, f.budget_variance_amt||0, f.budget_variance_pct||0,
      f.prior_year_noi||0, f.yoy_variance_pct||0, f.ytd_noi||0,
      f.notes||'', subject, from
    ]);
    SpreadsheetApp.flush();
    Logger.log('  ✓ Wrote financials_monthly: ' + plan.property_id + ' ' + rm);
  } catch(e) { Logger.log('financials write err: ' + e.message); }
}

function writeTaskToSheet(task) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.REPORT_SHEET_ID);
    let sheet = ss.getSheetByName('tasks');
    if (!sheet) { sheet = ss.insertSheet('tasks'); addHeaders(sheet, 'tasks'); sheet.setFrozenRows(1); }
    sheet.appendRow([
      new Date(), task.title||'', task.property||'general', task.assignee||'Bonny',
      task.priority||'medium', task.due||'', 'open', task.source||'', task.notes||'', task.meeting||''
    ]);
    SpreadsheetApp.flush();
  } catch(e) { Logger.log('task write err: ' + e.message); }
}

function addHeaders(sheet, tab) {
  const H = {
    snapshots: [
      'property_id','property_name','report_date','received_date',
      'physical_occupancy_pct','projected_occupancy_pct','economic_occupancy_pct',
      'total_units','occupied_units','vacant_units','vacant_ready_units',
      'preleased_units','preleased_move_in_dates','ntv_units','ntv_notice_dates',
      'move_ins_mtd','move_outs_mtd','evictions_in_progress',
      'leases_expiring_30d','leases_expiring_60d','leases_expiring_90d',
      'loss_to_lease_amt','avg_market_rent','avg_actual_rent','mtom_units',
      'new_prospects','visits','leases_signed_week','close_pct','top_ad_source',
      'collected_mtd','expected_mtd','delinquent_total',
      'delinq_0_30','delinq_31_60','delinq_61_90','delinq_90_plus',
      'largest_delinquent_unit','largest_delinquent_amt',
      'current_special','concessions_mtd',
      'trust_balance','aged_payables_total',
      'pm_focus','active_projects','upcoming_events','notes',
      'source_email','from_email'
    ],
    financials_monthly: [
      'property_id','property_name','report_month','received_date',
      'gross_potential_rent','vacancy_loss','concessions','bad_debt','other_income','egi',
      'repairs_maintenance','management_fee','insurance','property_tax',
      'utilities','admin','payroll','other_expenses','total_expenses',
      'noi','noi_margin_pct','expense_ratio','debt_service','cash_flow','dscr',
      'budget_noi','budget_variance_amt','budget_variance_pct',
      'prior_year_noi','yoy_variance_pct','ytd_noi',
      'notes','source_email','from_email'
    ],
    tasks: ['created_at','title','property','assignee','priority','due','status','source','notes','context'],
  };
  if (H[tab]) sheet.appendRow(H[tab]);
}

function resetReportSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.REPORT_SHEET_ID);
  const tabs = ['snapshots','financials_monthly','tasks'];
  tabs.forEach(function(n) {
    const existing = ss.getSheetByName(n);
    if (existing) ss.deleteSheet(existing);
    const s = ss.insertSheet(n);
    addHeaders(s, n);
    s.setFrozenRows(1);
  });
  Logger.log('✓ Reset ' + tabs.length + ' tabs');
}

// ── Task routing ─────────────────────────────────────────────
function isOutboundDelegation(from, to) {
  const fl = (from || '').toLowerCase();
  return CONFIG.BONNY_EMAILS.some(function(e) { return fl.includes(e.toLowerCase()); });
}

function extractRecipientName(toField) {
  const tc = (toField || '').toLowerCase();
  for (const p of ALL_PEOPLE) { if (p !== 'Bonny' && tc.includes(p.toLowerCase())) return p; }
  const m = (toField || '').match(/([^<@\s]+)@/);
  if (m) return m[1].replace(/[._-]/g,' ').split(' ').map(function(w){return w.charAt(0).toUpperCase()+w.slice(1);}).join(' ');
  return 'Team Member';
}

function processDelegation(subject, from, to, body) {
  const recipient = extractRecipientName(to);
  const prompt = 'Extract task Bonny is delegating to ' + recipient + '. Properties: ' +
    PROPS.map(function(p){return p.id;}).join(',') + '\n' +
    'JSON only: {"title":"","property":"","assignee":"' + recipient + '","priority":"medium","due":null,"notes":""} OR {"skip":true}\n' +
    'Subject: ' + subject + '\nTo: ' + to + '\nBody:\n' + body.substring(0, 1500);
  const r = callClaudeJson([{type:'text', text: prompt}], 500);
  if (!r || r.skip) return;
  writeTaskToSheet({
    title: r.title, property: r.property||'general', assignee: recipient,
    priority: r.priority||'medium', due: r.due||null, notes: r.notes||'',
    source: 'delegation', meeting: 'Delegated to ' + recipient + ' via email: ' + subject
  });
}

function processInbound(subject, from, body) {
  const prompt = 'Extract action items for Bonny. Properties: ' + PROPS.map(function(p){return p.id;}).join(',') + '\n' +
    'JSON only: {"is_fyi_only":false,"tasks":[{"title":"","property":"","assignee":"Bonny","priority":"medium","due":null,"notes":""}]}\n' +
    'Subject: ' + subject + '\nFrom: ' + from + '\nBody:\n' + body.substring(0, 1500);
  const r = callClaudeJson([{type:'text', text: prompt}], 800);
  if (!r || r.is_fyi_only || !r.tasks) return;
  r.tasks.forEach(function(t) {
    writeTaskToSheet({
      title: t.title, property: t.property||'general', assignee: t.assignee||'Bonny',
      priority: t.priority||'medium', due: t.due||null, notes: t.notes||'',
      source: 'email', meeting: 'Email: ' + subject + ' (from ' + from + ')'
    });
  });
}

// ── Triggers & diagnostics ───────────────────────────────────
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ScriptApp.deleteTrigger(t);});
  ScriptApp.newTrigger('checkNewEmails').timeBased().everyMinutes(CONFIG.CHECK_INTERVAL).create();
  Logger.log('✓ Trigger installed — every ' + CONFIG.CHECK_INTERVAL + 'm');
}
function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ScriptApp.deleteTrigger(t);});
  Logger.log('✓ Triggers removed');
}
function clearProcessedEmails() {
  const label = GmailApp.getUserLabelByName(CONFIG.PROCESSED_LABEL);
  if (!label) return;
  const threads = label.getThreads(0, 100);
  threads.forEach(function(t) { t.removeLabel(label); t.markUnread(); });
  Logger.log('Cleared ' + threads.length + ' threads');
}
function testLatestEmail() {
  const threads = GmailApp.search('is:unread', 0, 1);
  if (!threads.length) return;
  const m = threads[0].getMessages()[0];
  Logger.log('From: ' + m.getFrom() + '\nTo: ' + m.getTo() + '\nSubject: ' + m.getSubject());
  Logger.log('Attachments: ' + m.getAttachments().map(function(a){return a.getName();}).join(', '));
}

// ── Debug helpers ────────────────────────────────────────────
function _debugPropertyEmail(searchQuery, propLabel) {
  const threads = GmailApp.search(searchQuery, 0, 5);
  if (!threads.length) { Logger.log('No ' + propLabel + ' threads found'); return; }
  threads.forEach(function(t) {
    const msgs = t.getMessages();
    const latest = msgs[msgs.length - 1];
    Logger.log('—————————————————————————————————————');
    Logger.log('Subject:  ' + latest.getSubject());
    Logger.log('Date:     ' + latest.getDate());
    Logger.log('Labels:   ' + t.getLabels().map(function(l){return l.getName();}).join(', '));
    const atts = latest.getAttachments();
    Logger.log('Attachments: ' + atts.length);
    atts.forEach(function(att, i) {
      const name = att.getName();
      const norm = name.toLowerCase().replace(/[_+\-\s]+/g, ' ');
      const lower = name.toLowerCase();
      const isXls = lower.endsWith('.xls') || lower.endsWith('.xlsx');
      const isCsv = lower.endsWith('.csv');
      let bucket = 'none';
      if (isXls) {
        if (norm.includes('rent roll') || norm.includes('rentroll') || norm.includes('roll detail')) bucket = 'rentRoll';
        else if (norm.includes('avail')) bucket = 'availability';
        else if (norm.includes('resident balance') || norm.includes('fiscal period') || /\bbalances?\b/.test(norm)) bucket = 'residentBalances';
        else if (norm.includes('metrics by channel') || norm.includes('leasing') || norm.includes('channel')) bucket = 'te-extras:leasing';
        else bucket = 'xls-unmatched';
      } else if (isCsv) {
        if (norm.includes('delinquency') || norm.includes('delinquent')) bucket = 'te-extras:delinquency';
        else if (norm.includes('maintenance') || norm.includes('work order')) bucket = 'te-extras:maintenance';
        else bucket = 'csv-unmatched';
      }
      Logger.log('  [' + i + '] "' + name + '"');
      Logger.log('      type=' + att.getContentType() + ' size=' + att.getSize() + ' bucket=' + bucket);
    });
  });
}

function debugGroveEmail() {
  _debugPropertyEmail('subject:grove', 'Grove');
}

function debugTowneEastEmail() {
  _debugPropertyEmail('subject:towne OR subject:sunridge OR subject:te mmr', 'Towne East');
}

// ── Web App endpoint ─────────────────────────────────────────
function doGet(e) {
  const ss = SpreadsheetApp.openById(CONFIG.REPORT_SHEET_ID);
  const tabs = ['snapshots','financials_monthly','tasks'];
  const result = {};
  tabs.forEach(function(tab) {
    const sheet = ss.getSheetByName(tab);
    if (!sheet) { result[tab] = []; return; }
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) { result[tab] = []; return; }
    const headers = values[0];
    result[tab] = values.slice(1).filter(function(r){return r[0];}).map(function(row) {
      const obj = {};
      headers.forEach(function(h, i) {
        const key = String(h);
        const raw = row[i];
        if (key === 'report_month') obj[key] = monthKey(raw);
        else if (key === 'report_date') obj[key] = dateKey(raw);
        else if (raw instanceof Date) obj[key] = raw.toISOString();
        else obj[key] = raw !== undefined && raw !== null ? String(raw) : '';
      });
      return obj;
    });
  });
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
