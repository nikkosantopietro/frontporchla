// api/list-sales.js
//
// Lists every SOLD listing in a zone from the last 12 months, with address,
// property type, sale date, price and geo — so the raw rows can be cross-
// referenced against an external count. Reads only; no scraping.
//
//   /api/list-sales?secret=frontporchla2026sendmonthly            -> JSON
//   /api/list-sales?secret=...&format=csv                         -> CSV
//   /api/list-sales?secret=...&zone=<uuid>                        -> other zone

const { createClient } = require('@supabase/supabase-js');

const NORMA_TRIANGLE = '5329dda6-fa79-432d-a207-b7e8f9b9b05';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function homeInfo(row) {
  return row?.raw_data?.hdpData?.homeInfo || {};
}

function firstNonNull(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return null;
}

module.exports = async (req, res) => {
  const provided = req.query?.secret || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (provided !== process.env.CRON_SECRET) {
    return res.status(401).send('Not authorized. Add ?secret=YOUR_SECRET');
  }

  const zoneId = req.query?.zone || NORMA_TRIANGLE;
  const cutoffMs = Date.now() - 365 * 24 * 60 * 60 * 1000;

  const { data: sold, error } = await supabase
    .from('listings')
    .select('raw_data')
    .eq('zone_id', zoneId)
    .eq('status', 'sold');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const rows = (sold || []).map(r => {
    const h = homeInfo(r);
    const rd = r.raw_data || {};
    const zp = firstNonNull(h.zpid, rd.zpid);
    return {
      zpid: zp,
      address: firstNonNull(rd.address, h.streetAddress, rd.addressStreet),
      city: firstNonNull(h.city, rd.addressCity),
      zip: firstNonNull(h.zipcode, rd.addressZipcode),
      homeType: firstNonNull(h.homeType, rd.homeType),
      price: firstNonNull(h.price, null),
      beds: firstNonNull(h.bedrooms, null),
      baths: firstNonNull(h.bathrooms, null),
      livingArea: firstNonNull(h.livingArea, null),
      soldDate: h.dateSold ? new Date(h.dateSold).toISOString().slice(0, 10) : null,
      soldMs: h.dateSold || null,
      daysOnZillow: h.daysOnZillow,
      lat: firstNonNull(h.latitude, rd.latLong && rd.latLong.latitude),
      lng: firstNonNull(h.longitude, rd.latLong && rd.latLong.longitude),
      zillow: zp ? ('https://www.zillow.com/homedetails/' + zp + '_zpid/') : null,
    };
  })
  .filter(x => x.soldMs && x.soldMs >= cutoffMs && (x.price == null || x.price >= 100000))
  .sort((a, b) => b.soldMs - a.soldMs);

  // Property-type tally to immediately show the SFH-vs-condo mix.
  const byType = {};
  rows.forEach(r => {
    const k = r.homeType || '(unknown)';
    byType[k] = (byType[k] || 0) + 1;
  });

  if (req.query?.format === 'csv') {
    const cols = ['zpid', 'address', 'city', 'zip', 'homeType', 'price', 'beds', 'baths', 'livingArea', 'soldDate', 'daysOnZillow', 'lat', 'lng', 'zillow'];
    const esc = v => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => esc(r[c])).join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.status(200).send(csv);
  }

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    zoneId,
    count: rows.length,
    note: 'Data reflects the most recent scrape; sales after that date are not included.',
    byType,
    rows,
  });
};
