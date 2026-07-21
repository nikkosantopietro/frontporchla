// api/listings.js
//
// Public webpage: a sortable spreadsheet of every listing we've pulled for a
// zone — sold + active — with all the fields from the Apify/Zillow scrape.
// Linked from the monthly email. Read-only, no secret required.
//
//   /api/listings?zone=<uuid>   (defaults to Norma Triangle)

const { createClient } = require('@supabase/supabase-js');

const NORMA_TRIANGLE = '5329dda6-fa79-432d-a207-b7e8f9db9b05';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function homeInfo(row) {
  return row?.raw_data?.hdpData?.homeInfo || {};
}

function fmtMoney(n) {
  if (n == null || n === '') return '';
  const num = Number(n);
  if (isNaN(num)) return '';
  return '$' + num.toLocaleString();
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

module.exports = async (req, res) => {
  const zoneId = req.query?.zone || NORMA_TRIANGLE;

  const { data: zoneRow } = await supabase
    .from('zones').select('name').eq('id', zoneId).limit(1).single().then(r => r, () => ({ data: null }));
  const zoneName = (zoneRow && zoneRow.name) || 'Your Neighborhood';

  const { data: listings, error } = await supabase
    .from('listings')
    .select('raw_data, status')
    .eq('zone_id', zoneId);

  if (error) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(500).send('<p style="font-family:sans-serif;padding:24px">Could not load listings: ' + esc(error.message) + '</p>');
  }

  const rows = (listings || []).map(r => {
    const h = homeInfo(r);
    const rd = r.raw_data || {};
    const zp = h.zpid || rd.zpid || null;
    const sold = r.status === 'sold';
    return {
      status: sold ? 'Sold' : (r.status === 'for_sale' ? 'Active' : (r.status || '')),
      sold,
      address: rd.address || h.streetAddress || '',
      price: h.price || null,
      soldDate: h.dateSold ? new Date(h.dateSold).toISOString().slice(0, 10) : '',
      soldMs: h.dateSold || 0,
      beds: h.bedrooms != null ? h.bedrooms : '',
      baths: h.bathrooms != null ? h.bathrooms : '',
      sqft: h.livingArea || null,
      ppsf: (h.price && h.livingArea > 200) ? Math.round(h.price / h.livingArea) : null,
      yearBuilt: h.yearBuilt || rd.yearBuilt || '',
      homeType: (h.homeType || rd.homeType || '').replace(/_/g, ' '),
      zestimate: h.zestimate || null,
      zillow: zp ? ('https://www.zillow.com/homedetails/' + zp + '_zpid/') : '',
    };
  }).sort((a, b) => (b.sold - a.sold) || (b.soldMs - a.soldMs) || ((b.price || 0) - (a.price || 0)));

  const soldCount = rows.filter(r => r.sold).length;
  const activeCount = rows.filter(r => r.status === 'Active').length;

  const cols = [
    { k: 'status', label: 'Status', t: 'text' },
    { k: 'address', label: 'Address', t: 'text' },
    { k: 'price', label: 'Price', t: 'money' },
    { k: 'soldDate', label: 'Sold date', t: 'text' },
    { k: 'beds', label: 'Bd', t: 'num' },
    { k: 'baths', label: 'Ba', t: 'num' },
    { k: 'sqft', label: 'Sq ft', t: 'num' },
    { k: 'ppsf', label: '$/sqft', t: 'money' },
    { k: 'yearBuilt', label: 'Year', t: 'num' },
    { k: 'homeType', label: 'Type', t: 'text' },
    { k: 'zestimate', label: 'Zestimate', t: 'money' },
    { k: 'zillow', label: 'Link', t: 'link' },
  ];

  const headerCells = cols.map((c, i) => '<th data-col="' + i + '" data-type="' + c.t + '" onclick="sortBy(' + i + ')">' + esc(c.label) + ' <span class="ar"></span></th>').join('');

  const bodyRows = rows.map(r => {
    const tds = cols.map(c => {
      const v = r[c.k];
      if (c.t === 'link') return '<td>' + (v ? '<a href="' + esc(v) + '" target="_blank" rel="noopener">Zillow &#8599;</a>' : '') + '</td>';
      if (c.t === 'money') return '<td class="r" data-v="' + (v == null ? '' : v) + '">' + (v == null ? '' : fmtMoney(v)) + '</td>';
      if (c.t === 'num') return '<td class="r" data-v="' + (v === '' || v == null ? '' : v) + '">' + esc(v) + '</td>';
      const cls = c.k === 'status' ? (' class="status ' + (r.sold ? 'sold' : 'active') + '"') : '';
      return '<td' + cls + '>' + esc(v) + '</td>';
    }).join('');
    return '<tr>' + tds + '</tr>';
  }).join('');

  const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(zoneName) + ' — All Listings · Front Porch LA</title><style>' +
    'body{font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#fdfaf7;color:#2c2825;margin:0;padding:20px;}' +
    '.wrap{max-width:1100px;margin:0 auto;}' +
    'h1{font-family:Georgia,serif;font-size:22px;color:#3d5a47;margin:0 0 2px;}' +
    '.sub{color:#9b9088;font-size:13px;margin:0 0 16px;}' +
    '.tools{margin:0 0 12px;font-size:13px;}' +
    'input[type=search]{padding:8px 12px;border:1px solid #d4e8c8;border-radius:8px;font-size:14px;width:240px;max-width:60%;}' +
    '.pill{display:inline-block;margin-left:10px;padding:3px 10px;border-radius:100px;font-size:12px;background:#eef5e8;color:#3d5a47;}' +
    '.tablewrap{overflow-x:auto;border:1px solid #e8ddd0;border-radius:10px;background:#fff;}' +
    'table{border-collapse:collapse;width:100%;font-size:13px;}' +
    'th,td{padding:9px 11px;border-bottom:1px solid #f0e9df;text-align:left;white-space:nowrap;}' +
    'th{background:#3d5a47;color:#fff;position:sticky;top:0;cursor:pointer;font-size:12px;user-select:none;}' +
    'th:hover{background:#4a6741;}' +
    'td.r{text-align:right;}' +
    'tr:hover td{background:#faf6f0;}' +
    '.status{font-weight:600;}.status.sold{color:#854F0B;}.status.active{color:#2d7a4f;}' +
    'a{color:#3d5a47;}' +
    '.foot{color:#b3a89c;font-size:12px;margin-top:12px;}' +
    '</style></head><body><div class="wrap">' +
    '<h1>' + esc(zoneName) + ' — all listings we track</h1>' +
    '<p class="sub">Every sold and active listing from our data pull. Click any column to sort.</p>' +
    '<div class="tools"><input type="search" id="q" placeholder="Filter (address, type…)" oninput="filter()">' +
    '<span class="pill">' + soldCount + ' sold</span><span class="pill">' + activeCount + ' active</span></div>' +
    '<div class="tablewrap"><table id="t"><thead><tr>' + headerCells + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>' +
    '<p class="foot">Data reflects our most recent scrape; newest sales may lag. Source: Zillow via Apify.</p>' +
    '</div><script>' +
    'var dir={};function val(td){var d=td.getAttribute("data-v");if(d!==null&&d!=="")return parseFloat(d);return td.innerText.toLowerCase();}' +
    'function sortBy(i){var tb=document.querySelector("#t tbody");var rows=[].slice.call(tb.rows);var type=document.querySelectorAll("#t th")[i].getAttribute("data-type");dir[i]=!dir[i];var s=dir[i]?1:-1;' +
    'rows.sort(function(a,b){var x=val(a.cells[i]),y=val(b.cells[i]);if(x===""||x==null)return 1;if(y===""||y==null)return -1;if(x<y)return -1*s;if(x>y)return 1*s;return 0;});' +
    'rows.forEach(function(r){tb.appendChild(r);});}' +
    'function filter(){var q=document.getElementById("q").value.toLowerCase();var rows=document.querySelectorAll("#t tbody tr");rows.forEach(function(r){r.style.display=r.innerText.toLowerCase().indexOf(q)>-1?"":"none";});}' +
    '</script></body></html>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
