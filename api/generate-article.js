const https = require('https');

async function generateArticle(zoneName, marketStats, month, year) {
  const medianPrice = marketStats.medianPrice || 'not available';
  const pricePerSqFt = marketStats.pricePerSqFt || 'not available';
  const homesSold = marketStats.homesSold || 'not available';
  const daysOnMarket = marketStats.daysOnMarket || 'not available';
  const saleToList = marketStats.saleToList || 'not available';

  const prompt = 'You are writing a warm, conversational neighborhood update for homeowners in ' + zoneName + ', a prestigious area on the Westside of Los Angeles. These are affluent, informed homeowners who want to feel connected to their neighborhood.\n\n' +
    'Search the web for the following — prioritize results from the last 60 days:\n' +
    '1. Notable restaurant openings, chef-driven spots, or buzzy dining news in or near ' + zoneName + '\n' +
    '2. Celebrity home sales, notable property transactions, or architectural news in ' + zoneName + ' or nearby Westside neighborhoods\n' +
    '3. Local entertainment — new boutiques, art shows, pop-ups, events, or cultural moments\n' +
    '4. Any development, construction, or zoning news that affects the neighborhood\n' +
    '5. Anything a well-connected neighbor would be talking about at a dinner party\n\n' +
    'Then write a short neighborhood article (2-3 paragraphs, 120-180 words total) for ' + month + ' ' + year + ' using both what you found AND these market stats:\n' +
    '- Median sale price: ' + medianPrice + '\n' +
    '- Price per sq ft: ' + pricePerSqFt + '\n' +
    '- Homes sold: ' + homesSold + '\n' +
    '- Days on market: ' + daysOnMarket + '\n' +
    '- Sale-to-list ratio: ' + saleToList + '\n\n' +
    'Guidelines:\n' +
    '- Open with the most interesting local story you found — something specific, real, and worth talking about\n' +
    '- If you found a celebrity sale or notable property transaction, lead with that\n' +
    '- Weave market stats naturally into the second paragraph — do not list them, contextualize them\n' +
    '- End with one forward-looking sentence about what this means for homeowners\n' +
    '- Tone: warm, intelligent, insider — like a well-connected neighbor who happens to know the market cold\n' +
    '- Never salesy, never corporate, never generic\n' +
    '- Only reference things you actually found — never invent names, prices, or details\n' +
    '- Do not mention the agent by name\n' +
    '- Do not use the phrase pull up a chair\n\n' +
    'Respond in JSON format only with two fields:\n' +
    '{\n' +
    '  "title": "a specific, compelling 8-12 word headline — reference something real if you found it",\n' +
    '  "body": "the full article text"\n' +
    '}';

  return new Promise(function(resolve) {
    const data = JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search'
        }
      ],
      messages: [{ role: 'user', content: prompt }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, function(res) {
      let body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          const response = JSON.parse(body);
          const textBlock = response.content && response.content.find(function(block) { return block.type === 'text'; });
          const text = textBlock ? textBlock.text : '';
          const jsonMatch = text.match(/\{[\s\S]*"title"[\s\S]*"body"[\s\S]*\}/);
if (!jsonMatch) throw new Error('No JSON found in response');
const parsed = JSON.parse(jsonMatch[0]);
          resolve({
            title: parsed.title || (zoneName + ' in ' + month + ': What You Need to Know'),
            body: parsed.body || ('Your ' + zoneName + ' market showed strong activity this ' + month + '.')
          });
        } catch (err) {
          console.error('Article parse error:', err, body);
          resolve({
            title: zoneName + ' in ' + month + ': What You Need to Know',
            body: 'Your ' + zoneName + ' market continued to show strong activity this ' + month + '.'
          });
        }
      });
    });

    req.on('error', function(err) {
      console.error('Article generation error:', err);
      resolve({
        title: zoneName + ' in ' + month + ': What You Need to Know',
        body: 'Your ' + zoneName + ' market continued to show strong activity this ' + month + '.'
      });
    });

    req.write(data);
    req.end();
  });
}

module.exports = { generateArticle };
