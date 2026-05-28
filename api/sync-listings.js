const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const APIFY_TOKEN = process.env.APIFY_TOKEN;
const APIFY_ACTOR_ID = 'maxcopell~zillow-scraper';

module.exports = async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
   const testZone = req.query.zone;
    let zoneQuery = supabase.from('zones').select('id, name, coordinates');
    if (testZone) {
      zoneQuery = zoneQuery.ilike('name', testZone);
    }
    const { data: zones, error: zoneError } = await zoneQuery;

    if (zoneError) throw zoneError;
    if (!zones || zones.length === 0) {
      return res.status(200).json({ success: true, message: 'No zones to sync' });
    }

    const triggered = [];

    for (const zone of zones) {
      const coords = typeof zone.coordinates === 'string'
        ? JSON.parse(zone.coordinates)
        : zone.coordinates;

      if (!coords || coords.length === 0) continue;

      const lats = coords.map(c => c.lat);
      const lngs = coords.map(c => c.lng);
      const bounds = {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs)
      };

      const forSaleRun = await triggerApifyRun(bounds, 'forSale', zone.id);
      const soldRun = await triggerApifyRun(bounds, 'sold', zone.id);

      triggered.push({ zone: zone.name, forSaleRun, soldRun });
    }

    return res.status(200).json({
      success: true,
      zonesTriggered: triggered.length,
      runs: triggered
    });

  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function triggerApifyRun(bounds, status, zoneId) {
  const searchUrlState = encodeURIComponent(JSON.stringify({
    isMapVisible: true,
    mapBounds: bounds,
    filterState: status === 'sold'
      ? { sortSelection: { value: 'globalrelevanceex' }, isRecentlySold: { value: true }, isForSaleByAgent: { value: false }, isForSaleByOwner: { value: false }, isNewConstruction: { value: false }, isComingSoon: { value: false }, isAuction: { value: false }, isForSaleForeclosure: { value: false } }
      : { sortSelection: { value: 'globalrelevanceex' } },
    isListVisible: true
  }));

  const startUrl = `https://www.zillow.com/homes/${status === 'sold' ? 'sold' : 'for_sale'}/?searchQueryState=${searchUrlState}`;
  const webhookUrl = `https://frontporchla.com/api/apify-webhook?zoneId=${zoneId}&status=${status}&token=${process.env.CRON_SECRET}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const resp = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        searchUrls: [{ url: startUrl }],
        extractionMethod: 'PAGINATION_WITH_ZOOM_IN',
        maxItems: 4,
        webhooks: [{
          eventTypes: ['ACTOR.RUN.SUCCEEDED'],
          requestUrl: webhookUrl
        }]
      })
    });

    clearTimeout(timeoutId);
    const result = await resp.json();
    if (!resp.ok) {
      console.error(`Apify error for ${zoneId} ${status}:`, JSON.stringify(result));
      return null;
    }
    return result?.data?.id || null;
  } catch (err) {
    console.error(`Apify trigger failed for zone ${zoneId} ${status}:`, err.message);
    return null;
  }
}
