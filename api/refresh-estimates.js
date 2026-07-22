// api/refresh-estimates.js
//
// Looks up each subscriber's property value via Apify (Zillow, by address) and
// stores it on the subscriber (estimated_value + estimated_value_updated_at).
// Meant to run monthly (cron) and can be hit on-demand.
//
//   POST /api/refresh-estimates            (auth: Bearer CRON_SECRET)  -> refresh all
//   GET  /api/refresh-estimates?secret=...&debug=1   -> dry run, returns raw Apify
//        &email=<one subscriber>   -> limit to one
//        &address=<raw address>    -> test an arbitrary address (debug)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = 'maxcopell~zillow-scraper';

async function apifyByAddress(address) {
  const startUrl = 'https://www.zillow.com/homes/' + encodeURIComponent(address) + '_rb/';
  const resp = await fetch('https://api.apify.com/v2/acts/' + APIFY_ACTOR_ID + '/run-sync-get-dataset-items?token=' + APIFY_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addresses: [address], extractionMethod: 'MAP_MARKERS', maxItems: 5 }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    return { error: 'apify ' + resp.status + ': ' + txt.slice(0, 160), items: [] };
  }
  return { items: await resp.json() };
}

// pull a value out of a returned item, preferring the zestimate
function valueOf(item) {
  const h = (item && item.hdpData && item.hdpData.homeInfo) || {};
  return h.zestimate || item.zestimate || h.price || item.unformattedPrice || null;
}

function summarize(item) {
  const h = (item && item.hdpData && item.hdpData.homeInfo) || {};
  return {
    zpid: item.zpid, address: item.address || h.streetAddress,
    homeStatus: item.statusType || h.homeStatus,
    zestimate: h.zestimate || item.zestimate || null,
    price: h.price || item.unformattedPrice || null,
    value: valueOf(item),
  };
}

module.exports = async (req, res) => {
  const provided = (req.query && req.query.secret) || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (provided !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const debug = req.query && req.query.debug === '1';
  const email = req.query && req.query.email;
  const rawAddress = req.query && req.query.address;

  // Debug: test an arbitrary address directly.
  if (rawAddress) {
    const r = await apifyByAddress(rawAddress);
    return res.status(200).json({ mode: 'raw-address', address: rawAddress, error: r.error, count: (r.items || []).length, items: (r.items || []).slice(0, 5).map(summarize) });
  }

  let q = supabase.from('subscribers').select('id, email, address, estimated_value').not('address', 'is', null).eq('unsubscribed', false);
  if (email) q = q.eq('email', email);
  const { data: subs, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  if (!subs || subs.length === 0) return res.status(200).json({ message: 'no subscribers with an address' });

  const results = [];
  for (const sub of subs) {
    const r = await apifyByAddress(sub.address);
    const items = r.items || [];
    // best match: exact-ish address, else first
    const key = (sub.address || '').split(',')[0].toLowerCase().trim();
    const match = items.find(it => ((it.address || '') + '').toLowerCase().includes(key)) || items[0];
    const value = match ? valueOf(match) : null;

    if (debug) {
      results.push({ email: sub.email, address: sub.address, apifyError: r.error, count: items.length, chosen: match ? summarize(match) : null });
      continue;
    }
    if (value) {
      await supabase.from('subscribers').update({ estimated_value: value, estimated_value_updated_at: new Date().toISOString() }).eq('id', sub.id);
      results.push({ email: sub.email, updated: true, value });
    } else {
      results.push({ email: sub.email, updated: false, reason: r.error || 'no value found', count: items.length });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return res.status(200).json({ mode: debug ? 'debug' : 'refresh', processed: results.length, results });
};
