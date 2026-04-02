const https = require('https');

async function generateArticle(zoneName, marketStats, month, year) {
  const prompt = `You are writing a warm, conversational neighborhood market update for homeowners in ${zoneName}, a prestigious area on the Westside of Los Angeles. The tone is like a knowledgeable friend pulling up a chair to share what's happening in the neighborhood — not a corporate real estate report.

Write a short neighborhood article (2-3 paragraphs, 120-180 words total) for ${month} ${year} using these market stats:
- Median sale price: ${marketStats.medianPrice || 'not available'}
- Price per sq ft: ${marketStats.pricePerSqFt || 'not available'}
- Homes sold: ${marketStats.homesSold || 'not available'}
- Days on market: ${marketStats.daysOnMarket || 'not available'}
- Sale-to-list ratio: ${marketStats.saleToList || 'not available'}

Guidelines:
- Start with something specific and grounding about ${zoneName}
- Weave in 2-3 of the stats naturally — don't just list them
- End with a forward-looking sentence about what this means for homeowners
- Warm, intelligent tone — never salesy or corporate
- Do not mention the agent by name
- Do not use the phrase "pull up a chair"

Respond in JSON format only with two fields:
{
  "title": "a compelling 8-12 word headline for the article",
  "body": "the full article text"
}`;

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
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
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          const text = response.content?.[0]?.text || '';
          const clean = text.replace(/```json|```/g, '').trim();
          const parsed = JSON.parse(clean);
          resolve({
            title: parsed.title || `${zoneName} in ${month}: What You Need to Know`,
            body: parsed.body || `Your ${zoneName} market showed strong activity this ${month}.`
          });
        } catch (err) {
          console.error('Article parse error:', err);
          resolve({
            title: `${zoneName} in ${month}: What You Need to Know`,
            body: `Your ${zoneName} market continued to show strong activity this ${month}. Stay tuned for more detailed insights as we gather more data for your specific area.`
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Article generation error:', err);
      resolve({
        title: `${zoneName} in ${month}: What You Need to Know`,
        body: `Your ${zoneName} market continued to show strong activity this ${month}. Stay tuned for more detailed insights as we gather more data for your specific area.`
      });
    });

    req.write(data);
    req.end();
  });
}

module.exports = { generateArticle };
