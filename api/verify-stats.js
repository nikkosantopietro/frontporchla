// api/verify-stats.js
//
// One-click stats verification for Front Porch LA.
// Runs the SAME getZoneStats() logic as api/monthly-send.js against a zone and
// renders the results as a plain, human-readable web page — no email, no
// terminal, no keys to type. Visit it in a browser:
//
//   https://<your-vercel-domain>/api/verify-stats?secret=frontporchla2026sendmonthly
//
// Optionally override the zone:  &zone=<zone-uuid>
//
// It reuses Vercel's existing env vars (SUPABASE_URL, SUPABASE_SERVICE_KEY,
// CRON_SECRET), so nothing new needs to be configured.

const { createClient } = require('@supabase/supabase-js');

const NORMA_TRIANGLE = '5329dda6-fa79-432d-a207-b7e8f9db9b05';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ---- Shared logic (mirrors api/monthly-send.js) -----------------------------

// Flat columns are NULL from the scraper — real values live nested in raw_data.
function homeInfo(row) {
  return row?.raw_data?.hdpData?.homeInfo || {};
}

function formatCurrency(num) {
  if (!num) return 'N/A';
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K';
  return '$' + Math.round(num).toLocaleString();
}

function median(sortedNums) {
  if (sortedNums.length === 0) return null;
  const mid = Math.floor(sortedNums.length / 2);
  return sortedNums.length % 2
    ? sortedNums[mid]
    : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
}

// Exact copy of production getZoneStats() so we verify the real code path.
async function getZoneStats(zoneId) {
  const cutoffMs = Date.now() - 365 * 24 * 60 * 60 * 1000;

  const { data: sold } = await supabase
    .from('listings').select('raw_data')
    .eq('zone_id', zoneId).eq('status', 'sold');

  const { data: active } = await supabase
    .from('listings').select('raw_data')
    .eq('zone_id', zoneId).eq('status', 'for_sale');

  const stats = {
    medianPrice: 'N/A', pricePerSqFt: 'N/A', homesSold: '0',
    daysOnMarket: 'N/A', activeListings: '0', marketStatus: 'Balanced Market',
  };

  const recentSolds = (sold || []).filter(r => {
    const h = homeInfo(r);
    return h.dateSold && h.dateSold >= cutoffMs && h.price >= 100000;
  });

  if (recentSolds.length > 0) {
    const prices = recentSolds.map(r => homeInfo(r).price)
      .filter(p => p >= 100000).sort((a, b) => a - b);
    if (prices.length > 0) stats.medianPrice = formatCurrency(median(prices));

    const ppsf = recentSolds.map(r => homeInfo(r))
      .filter(h => h.price >= 100000 && h.livingArea > 200)
      .map(h => h.price / h.livingArea);
    if (ppsf.length > 0) {
      stats.pricePerSqFt = '$' + Math.round(ppsf.reduce((a, b) => a + b, 0) / ppsf.length).toLocaleString();
    }

    stats.homesSold = recentSolds.length.toString();

    const dom = recentSolds.map(r => homeInfo(r).daysOnZillow)
      .filter(d => d != null && d >= 0 && d < 365);
    if (dom.length > 0) {
      stats.daysOnMarket = Math.round(dom.reduce((a, b) => a + b, 0) / dom.length).toString();
    }
  }

  const activeListings = (active || []).filter(r => homeInfo(r).price >= 100000);
  if (activeListings.length > 0) stats.activeListings = activeListings.length.toString();

  const soldCount = recentSolds.length;
  const activeCount = activeListings.length;
  if (soldCount > 0 || activeCount > 0) {
    if (activeCount === 0 || soldCount / Math.max(activeCount, 1) > 1.2) stats.marketStatus = "Seller's Market";
    else if (soldCount / Math.max(activeCount, 1) < 0.6) stats.marketStatus = "Buyer's Market";
    else stats.marketStatus = 'Balanced Market';
  }

  return stats;
}

// ---- Diagnostics ------------------------------------------------------------

async function diagnose(zoneId) {
  const cutoffMs = Date.now() - 365 * 24 * 60 * 60 * 1000;

  const { data: sold } = await supabase
    .from('listings').select('raw_data')
    .eq('zone_id', zoneId).eq('status', 'sold');
  const { data: active } = await supabase
    .from('listings').select('raw_data')
    .eq('zone_id', zoneId).eq('status', 'for_sale');

  const soldRows = sold || [];
  const activeRows = active || [];

  const withDateSold = soldRows.filter(r => homeInfo(r).dateSold);
  const inWindow = soldRows.filter(r => {
    const h = homeInfo(r);
    return h.dateSold && h.dateSold >= cutoffMs;
  });
  const rentals = inWindow.filter(r => !(homeInfo(r).price >= 100000));
  const recentSolds = inWindow.filter(r => homeInfo(r).price >= 100000);

  const domRaw = recentSolds.map(r => homeInfo(r).daysOnZillow);
  const domWithheld = domRaw.filter(d => d === -1).length;
  const domNull = domRaw.filter(d => d == null).length;
  const domStale = domRaw.filter(d => d != null && d >= 365).length;
  const domUsed = domRaw.filter(d => d != null && d >= 0 && d < 365).sort((a, b) => a - b);

  const prices = recentSolds.map(r => homeInfo(r).price)
    .filter(p => p >= 100000).sort((a, b) => a - b);

  const activeNonRental = activeRows.filter(r => homeInfo(r).price >= 100000);

  const stats = await getZoneStats(zoneId);

  const flags = [];
  if (recentSolds.length > 200) flags.push('Homes sold is over 200 — the 12-month date filter may not be working (the old bug showed 155+).');
  if (stats.daysOnMarket !== 'N/A' && Number(stats.daysOnMarket) > 200) flags.push('Days on market is over 200 — stale relistings may still be leaking past the under-365 filter.');
  if (stats.activeListings === '0' && activeRows.length > 0) flags.push('Active listings shows 0 even though for-sale rows exist — prices may not be parsing.');

  return {
    zoneId, cutoffDate: new Date(cutoffMs).toISOString().slice(0, 10),
    soldTotal: soldRows.length, withDateSold: withDateSold.length,
    inWindow: inWindow.length, rentals: rentals.length, recentSolds: recentSolds.length,
    priceCount: prices.length,
    priceMin: prices.length ? formatCurrency(prices[0]) : '—',
    priceMedian: prices.length ? formatCurrency(median(prices)) : '—',
    priceMax: prices.length ? formatCurrency(prices[prices.length - 1]) : '—',
    domTotal: domRaw.length, domNull, domWithheld, domStale, domUsed: domUsed.length,
    domAvg: domUsed.length ? Math.round(domUsed.reduce((a, b) => a + b, 0) / domUsed.length) : '—',
    activeTotal: activeRows.length, activeNonRental: activeNonRental.length,
    stats, flags,
  };
}

// ---- HTML rendering ---------------------------------------------------------

function esc(s) { return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function row(label, value, hint) {
  return `<tr><td class="l">${esc(label)}${hint ? `<span class="hint">${esc(hint)}</span>` : ''}</td><td class="v">${esc(value)}</td></tr>`;
}

function renderPage(d) {
  const s = d.stats;
  const flagsHtml = d.flags.length
    ? `<div class="flags warn"><strong>⚠ Things to look at</strong><ul>${d.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`
    : `<div class="flags ok"><strong>✓ All checks passed.</strong> Nothing looks off.</div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stats check · Front Porch LA</title>
<style>
  body{font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#fdfaf7;color:#2c2825;margin:0;padding:24px;}
  .wrap{max-width:680px;margin:0 auto;}
  h1{font-family:Georgia,serif;font-size:24px;color:#3d5a47;margin:0 0 4px;}
  .sub{color:#9b9088;font-size:13px;margin:0 0 24px;}
  .card{background:#fff;border:1px solid #e8ddd0;border-radius:12px;padding:18px 20px;margin-bottom:18px;}
  .card h2{font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#3d5a47;margin:0 0 12px;}
  table{width:100%;border-collapse:collapse;}
  td{padding:7px 0;font-size:14px;border-bottom:1px solid #f0e9df;vertical-align:top;}
  tr:last-child td{border-bottom:none;}
  td.l{color:#6b6058;}
  td.v{text-align:right;font-weight:600;color:#2c2825;white-space:nowrap;padding-left:16px;}
  .hint{display:block;font-size:11px;color:#b3a89c;font-weight:400;margin-top:2px;}
  .big td{font-size:16px;padding:9px 0;}
  .flags{border-radius:8px;padding:14px 16px;font-size:14px;}
  .flags.ok{background:#eef5e8;color:#3d5a47;}
  .flags.warn{background:#fef3dc;color:#854F0B;}
  .flags ul{margin:8px 0 0;padding-left:20px;}
  .flags li{margin-bottom:6px;}
</style></head>
<body><div class="wrap">
  <h1>Neighborhood stats check</h1>
  <p class="sub">Zone ${esc(d.zoneId)} · counting sales since ${esc(d.cutoffDate)} · ${new Date().toLocaleString()}</p>

  ${flagsHtml}

  <div class="card">
    <h2>What the email would show</h2>
    <table class="big">
      ${row('Median price', s.medianPrice)}
      ${row('Price per sq ft', s.pricePerSqFt)}
      ${row('Homes sold (last 12 mo)', s.homesSold)}
      ${row('Avg days on market', s.daysOnMarket)}
      ${row('Active listings', s.activeListings)}
      ${row('Market status', s.marketStatus)}
    </table>
  </div>

  <div class="card">
    <h2>How "homes sold" was counted</h2>
    <table>
      ${row('All sold records in zone', d.soldTotal)}
      ${row('…that have a sale date', d.withDateSold)}
      ${row('…sold within last 12 months', d.inWindow)}
      ${row('…removed as rentals (under $100k)', d.rentals)}
      ${row('Final count used', d.recentSolds, 'this is the "Homes sold" number above')}
    </table>
  </div>

  <div class="card">
    <h2>Sale prices used</h2>
    <table>
      ${row('Number of sales', d.priceCount)}
      ${row('Lowest', d.priceMin)}
      ${row('Median', d.priceMedian)}
      ${row('Highest', d.priceMax)}
    </table>
  </div>

  <div class="card">
    <h2>Days on market breakdown</h2>
    <table>
      ${row('Sales looked at', d.domTotal)}
      ${row('No value listed', d.domNull)}
      ${row('Hidden by Zillow (-1)', d.domWithheld)}
      ${row('Excluded as stale (365+ days)', d.domStale, 'old relistings that were dragging the average up')}
      ${row('Actually used in average', d.domUsed)}
      ${row('Average days on market', d.domAvg, 'this is the number above')}
    </table>
  </div>

  <div class="card">
    <h2>Active listings</h2>
    <table>
      ${row('All for-sale records in zone', d.activeTotal)}
      ${row('Counted (price $100k+)', d.activeNonRental)}
    </table>
  </div>
</div></body></html>`;
}

// ---- Vercel handler ---------------------------------------------------------

module.exports = async (req, res) => {
  // Auth: header Bearer (like monthly-send) OR ?secret= for easy browser use.
  const headerSecret = (req.headers['authorization'] || '').replace('Bearer ', '');
  const provided = req.query?.secret || headerSecret;
  if (provided !== process.env.CRON_SECRET) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send('<p style="font-family:sans-serif">Not authorized. Add <code>?secret=YOUR_SECRET</code> to the URL.</p>');
  }

  const zoneId = req.query?.zone || NORMA_TRIANGLE;

  try {
    const d = await diagnose(zoneId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderPage(d));
  } catch (err) {
    console.error('verify-stats error:', err);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send('<pre style="font-family:monospace;padding:20px">verify-stats failed:\n' + esc(err.message) + '</pre>');
  }
};
