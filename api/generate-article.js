const prompt = `You are writing a warm, conversational neighborhood update for homeowners in ${zoneName}, a prestigious area on the Westside of Los Angeles. These are affluent, informed homeowners who want to feel connected to their neighborhood.

Search the web for the following — prioritize results from the last 60 days:
1. Notable restaurant openings, chef-driven spots, or buzzy dining news in or near ${zoneName}
2. Celebrity home sales, notable property transactions, or architectural news in ${zoneName} or nearby Westside neighborhoods
3. Local entertainment — new boutiques, art shows, pop-ups, events, or cultural moments
4. Any development, construction, or zoning news that affects the neighborhood
5. Anything a well-connected neighbor would be talking about at a dinner party

Then write a short neighborhood article (2-3 paragraphs, 120-180 words total) for ${month} ${year} using both what you found AND these market stats:
- Median sale price: ${marketStats.medianPrice || 'not available'}
- Price per sq ft: ${marketStats.pricePerSqFt || 'not available'}
- Homes sold: ${marketStats.homesSold || 'not available'}
- Days on market: ${marketStats.daysOnMarket || 'not available'}
- Sale-to-list ratio: ${marketStats.saleToList || 'not available'}

Guidelines:
- Open with the most interesting local story you found — something specific, real, and worth talking about
- If you found a celebrity sale or notable property transaction, lead with that
- Weave market stats naturally into the second paragraph — don't list them, contextualize them
- End with one forward-looking sentence about what this means for homeowners
- Tone: warm, intelligent, insider — like a well-connected neighbor who happens to know the market cold
- Never salesy, never corporate, never generic
- Only reference things you actually found — never invent names, prices, or details
- Do not mention the agent by name
- Do not use the phrase "pull up a chair"

Respond in JSON format only with two fields:
{
  "title": "a specific, compelling 8-12 word headline — reference something real if you found it",
  "body": "the full article text"
}`;
