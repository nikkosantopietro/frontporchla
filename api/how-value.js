// api/how-value.js
//
// Public explainer page: how a property's estimated value is calculated.
// Deliberately generic (no data-source names), sets expectations that an
// automated estimate is not exact, and ends with a call to action.
//
//   /api/how-value?contact=<url or mailto>&agent=<name>

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

module.exports = async (req, res) => {
  const agent = esc(req.query?.agent || 'your Front Porch LA agent');
  const contact = esc(req.query?.contact || 'https://frontporchla.com');

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>How your home's estimated value is calculated · Front Porch LA</title>
<style>
  body{font-family:-apple-system,Segoe UI,Arial,sans-serif;background:#f0f4ee;color:#2c2c2a;margin:0;padding:24px;line-height:1.65;}
  .wrap{max-width:620px;margin:0 auto;background:#fff;border:1px solid #d4e8c8;border-radius:14px;overflow:hidden;}
  .head{background:#4a6741;padding:30px 34px;}
  .kicker{margin:0 0 6px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#b8d4a8;}
  h1{margin:0;font-family:Georgia,serif;font-size:26px;color:#f5f9f2;font-weight:normal;}
  .body{padding:28px 34px;}
  h2{font-family:Georgia,serif;font-size:18px;color:#1e3318;margin:26px 0 8px;}
  h2:first-child{margin-top:0;}
  p{margin:0 0 12px;font-size:15px;color:#3a3a37;}
  ul{margin:0 0 12px;padding-left:20px;}
  li{margin-bottom:6px;font-size:15px;}
  .note{background:#f2f7ee;border:1px solid #d4e8c8;border-radius:10px;padding:16px 18px;margin:18px 0;font-size:14px;color:#3d5a47;}
  .cta{background:#1e3318;border-radius:12px;padding:24px 26px;margin-top:22px;text-align:center;}
  .cta p{color:#dfece0;font-size:15px;margin:0 0 16px;}
  .cta a{display:inline-block;background:#8ab87a;color:#12220d;padding:13px 26px;border-radius:6px;font-size:14px;font-weight:bold;text-decoration:none;}
  .foot{padding:16px 34px 26px;color:#9b9088;font-size:12px;}
</style></head>
<body><div class="wrap">
  <div class="head">
    <p class="kicker">Front Porch LA</p>
    <h1>How your home's estimated value is calculated</h1>
  </div>
  <div class="body">
    <h2>What goes into the estimate</h2>
    <p>Your property's estimated value comes from an automated valuation model. It weighs a few things together:</p>
    <ul>
      <li><strong>Recent nearby sales</strong> — what comparable homes close to you have actually sold for.</li>
      <li><strong>Your property's characteristics</strong> — size, bedrooms, bathrooms, lot, and location.</li>
      <li><strong>Current market trends</strong> — how prices are moving across your neighborhood right now.</li>
    </ul>
    <p>Those inputs are blended into a single number meant to reflect roughly what your home might be worth in today's market.</p>

    <h2>Why it's an estimate — not an exact price</h2>
    <p>An automated model has never walked through your front door. It can't see renovations, upgrades, condition, views, natural light, or the dozens of details that move a real sale price. Two homes that look identical on paper can sell for very different amounts.</p>
    <div class="note">Think of this number as a well-informed starting point — a ballpark, not an appraisal. Estimators do their best with the data available, but they are never exact.</div>

    <div class="cta">
      <p>Want a precise figure? ${agent} will prepare a free, no-obligation price opinion based on a real look at your home and the current market — it takes about 15 minutes.</p>
      <a href="${contact}">Get a real valuation &#8594;</a>
    </div>
  </div>
  <div class="foot">Front Porch LA &nbsp;&middot;&nbsp; Westside neighborhood market intelligence</div>
</div></body></html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
};
