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

    const results = [];

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

      const forSale = await scrapeAndStore(bounds, 'forSale', zone, coords);
      const sold = await scrapeAndStore(bounds, 'sold', zone, coords);

      results.push({ zone: zone.name, forSale, sold });
    }

    return res.status(200).json({ success: true, zonesProcessed: results.length, results });

  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function scrapeAndStore(bounds, status, zone, coords) {
  const searchUrlState = encodeURIComponent(JSON.stringify({
    isMapVisible: true,
    mapBounds: bounds,
    filterState: status === 'sold'
      ? { sortSelection: { value: 'globalrelevanceex' }, isRecentlySold: { value: true }, isForSaleByAgent: { value: false }, isForSaleByOwner: { value: false }, isNewConstruction: { value: false }, isComingSoon: { value: false }, isAuction: { value: false }, isForSaleForeclosure: { value: false } }
      : { sortSelection: { value: 'globalrelevanceex' } },
    isListVisible: true
  }));

  const startUrl = `https://www.zillow.com/homes/${status === 'sold' ? 'sold' : 'for_sale'}/?searchQueryState=${searchUrlState}`;

  try {
    const resp = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchUrls: [{ url: startUrl }],
        extractionMethod: 'MAP_MARKERS',
        maxItems: 200
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`Apify scrape failed (${status}):`, txt.substring(0, 200));
      return { error: 'scrape failed', inserted: 0 };
    }

    const items = await resp.json();
    let inserted = 0, skipped = 0;

    for (const item of items) {
      const lat = item.latLong?.latitude;
      const lng = item.latLong?.longitude;
      if (!lat || !lng) { skipped++; continue; }
      if (!pointInPolygon({ lat, lng }, coords)) { skipped++; continue; }

      const isSold = status === 'sold' || (item.statusType || '').toLowerCase().includes('sold');

      const listingData = {
        zpid: item.zpid?.toString(),
        detail_url: item.detailUrl,
        street_address: item.addressStreet,
        city: item.addressCity,
        state: item.addressState,
        zip: item.addressZipcode,
        full_address: item.address,
        latitude: lat,
        longitude: lng,
        status: isSold ? 'sold' : (item.statusType?.toLowerCase().includes('pending') ? 'pending' : 'for_sale'),
        listing_type: isSold ? 'sold' : 'for_sale',
        price: parsePrice(item.unformattedPrice),
        sold_price: parsePrice(item.soldPrice) || (isSold ? parsePrice(item.unformattedPrice) : null),
        sold_date: item.dateSold ? new Date(item.dateSold).toISOString().split('T')[0] : null,
        zestimate: parsePrice(item.zestimate),
        rent_zestimate: parsePrice(item.rentZestimate),
        beds: item.beds,
        baths: item.baths,
        sqft: item.area,
        year_built: item.yearBuilt,
        home_type: item.hdpData?.homeInfo?.homeType,
        days_on_market: item.daysOnZillow,
        primary_photo: item.imgSrc,
        photos: item.carouselPhotosComposable || null,
        zone_id: zone.id,
        raw_data: item,
        updated_at: new Date().toISOString()
      };

      if (!listingData.zpid) { skipped++; continue; }

      const { error } = await supabase
        .from('listings')
        .upsert(listingData, { onConflict: 'zpid' });

      if (!error) inserted++;
      else { skipped++; if (skipped < 3) console.log('INSERT ERROR:', JSON.stringify(error)); }
    }

    console.log(`${zone.name} (${status}): ${inserted} inserted, ${skipped} skipped, ${items.length} total`);
    return { inserted, skipped, total: items.length };

  } catch (err) {
    console.error(`scrapeAndStore error (${status}):`, err.message);
    return { error: err.message, inserted: 0 };
  }
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function parsePrice(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val;
  let s = String(val).replace(/[$,\s]/g, '');
  if (s.toUpperCase().endsWith('M')) return Math.round(parseFloat(s) * 1000000);
  if (s.toUpperCase().endsWith('K')) return Math.round(parseFloat(s) * 1000);
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
