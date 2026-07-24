// api/test-avm.js
// Quick ATTOM AVM tester for a single address (or a subscriber by email).
//   GET /api/test-avm?secret=<CRON_SECRET>&address=<full address>
//   GET /api/test-avm?secret=<CRON_SECRET>&email=<subscriber email>
// Returns the raw ATTOM responses so we can confirm the key + endpoint + fields.

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

function parseAddress(full) {
  if (!full) return null;
  const cleaned = full.replace(/,?\s*USA\s*$/i, '').trim();
  const parts = cleaned.split(',');
  if (parts.length < 2) return null;
  return { street: parts[0].trim(), cityStateZip: parts.slice(1).join(',').trim() };
}

async function call(path, params) {
  try {
    const res = await fetch(ATTOM_BASE + path + '?' + params.toString(), {
      headers: { apikey: process.env.ATTOM_API_KEY, Accept: 'application/json' },
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, ok: res.ok, body: json || text.slice(0, 400) };
  } catch (e) {
    return { error: String(e).slice(0, 200) };
  }
}

function valueFrom(resp) {
  const prop = resp && resp.body && resp.body.property && resp.body.property[0];
  const avm = prop && prop.avm;
  if (!avm) return null;
  return {
    estimate: avm.amount && avm.amount.value,
    low: avm.amount && avm.amount.low,
    high: avm.amount && avm.amount.high,
  };
}

module.exports = async (req, res) => {
  const provided = (req.query && req.query.secret) || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (provided !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  let address = req.query && req.query.address;
  const email = req.query && req.query.email;

  if (!address && email) {
    const { data } = await supabase.from('subscribers').select('address').eq('email', email).limit(1);
    address = data && data[0] && data[0].address;
  }
  if (!address) return res.status(400).json({ error: 'Provide ?address= or ?email=' });

  const parsed = parseAddress(address);
  if (!parsed) return res.status(400).json({ error: 'Could not parse address', address });

  const params = new URLSearchParams({ address1: parsed.street, address2: parsed.cityStateZip });

  const out = {
    address,
    parsed,
    keyPresent: !!process.env.ATTOM_API_KEY,
    attomavm_detail: await call('/attomavm/detail', params),
    avm_snapshot: await call('/avm/snapshot', params),
  };
  out.value = valueFrom(out.attomavm_detail) || valueFrom(out.avm_snapshot);

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(out);
};

