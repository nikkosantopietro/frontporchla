// api/test-article.js
// Diagnostic for the "Around the Neighborhood" Anthropic call.
//   GET /api/test-article?secret=<CRON_SECRET>
// Returns whether the key is present + the raw status/body of a plain call and
// a web-search call, so we can see exactly why generate-article falls back.

const https = require('https');

function call(payload) {
  return new Promise(function (resolve) {
    const data = JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Length': Buffer.byteLength(data),
      },
    }, function (res) {
      let b = '';
      res.on('data', function (c) { b += c; });
      res.on('end', function () { resolve({ status: res.statusCode, body: b.slice(0, 500) }); });
    });
    req.on('error', function (e) { resolve({ error: String(e).slice(0, 200) }); });
    req.write(data);
    req.end();
  });
}

module.exports = async function (req, res) {
  const provided = (req.query && req.query.secret) || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (provided !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const out = {
    keyPresent: !!process.env.ANTHROPIC_API_KEY,
    keyPrefix: (process.env.ANTHROPIC_API_KEY || '').slice(0, 8),
  };
  out.simple = await call({ model: 'claude-opus-4-5', max_tokens: 64, messages: [{ role: 'user', content: 'Say hello in three words.' }] });
  out.withSearch = await call({ model: 'claude-opus-4-5', max_tokens: 256, tools: [{ type: 'web_search_20250305', name: 'web_search' }], messages: [{ role: 'user', content: 'One recent headline about West Hollywood, one sentence.' }] });
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(out);
};

