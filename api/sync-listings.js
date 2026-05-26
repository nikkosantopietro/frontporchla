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
    const { data: zones, error: zoneError } = await supabase
      .from('zones')
      .select('id, name, coordinates');

    if (zoneError) throw zoneError;
    if (!zones || zones.length === 0) {
      return res.status(200).json({ success: true, message: 'No zones to sync' });
    }

    let totalInserted = 0;
    let totalUpdated = 0;

    for (const zone of zones) {
      const coords = typeof zone.coordinates === 'string'
        ? JSON.parse(zone.coordinates)
        : zone.coordinates;

      if (!coords || coords.length === 0) continue;

      const lats = coords.map(c => c.lat);
      const lngs = coords.map(c => c.lng);
      const north = Math.max(...lats);
      const south = Math.min(...lats);
      const east = Math.max(...lngs);
      const west = Math.min(...lngs);

      const forSaleResults = await runApifyScraper(north, south, east, west, 'forSale');
      const soldResults = await runApifyScraper(north, south, east, west, 'sold');

      const allResults = [...forSaleResults, ...soldResults];

      for (const item of allResults) {
        const inZone = pointInPolygon(
          { lat: item.latitude, lng: item.longitude },
          coords
        );
        if (!inZone) continue;

        const listingData = {
          zpid: item.zpid?.toString(),
          detail_url: item.detailUrl,
          street_address: item.address?.streetAddress,
          city: item.address?.city,
          state: item.address?.state,
          zip: item.address?.zipcode,
          full_address: [item.address?.streetAddress, item.address?.city, item.address?.state, item.address?.zipcode].filter(Boolean).join(', '),
          latitude: item.latitude,
          longitude: item.longitude,
          status: item.statusType?.toLowerCase().includes('sold') ? 'sold' : item.statusType?.toLowerCase().includes('pending') ? 'pending' : 'for_sale',
          listing_type: item.statusType?.toLowerCase().includes('sold') ? 'sold' : 'for_sale',
          price: item.price || item.unformattedPrice,
          sold_price: item.statusType?.toLowerCase().includes('sold') ? (item.price || item.unformattedPrice) : null,
          sold_date: item.dateSold ? new Date(item.dateSold).toISOString().split('T')[0] : null,
          zestimate: item.zestimate,
          rent_zestimate: item.rentZestimate,
          beds: item.beds,
          baths: item.baths,
          sqft: item.area,
          year_built: item.yearBuilt,
          home_type: item.hdpData?.homeInfo?.homeType,
          days_on_market: item.daysOnZillow,
          primary_photo: item.imgSrc,
          photos: item.carouselPhotos || null,
          zone_id: zone.id,
          raw_data: item,
          updated_at: new Date().toISOString()
        };

        if (!listingData.zpid) continue;

        const { error } = await supabase
          .from('listings')
          .upsert(listingData, { onConflict: 'zpid' });

        if (!error) totalInserted++;
      }
    }

    return res.status(200).json({
      success: true,
      zonesProcessed: zones.length,
      listingsUpserted: totalInserted
    });

  } catch (err) {
    console.error('Sync error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function runApifyScraper(north, south, east, west, status) {
  const searchUrlState = encodeURIComponent(JSON.stringify({
    isMapVisible: true,
    mapBounds: { north, south, east, west },
    filterState: status === 'sold'
      ? { sortSelection: { value: 'globalrelevanceex' }, isRecentlySold: { value: true }, isForSaleByAgent: { value: false }, isForSaleByOwner: { value: false }, isNewConstruction: { value: false }, isComingSoon: { value: false }, isAuction: { value: false }, isForSaleForeclosure: { value: false } }
      : { sortSelection: { value: 'globalrelevanceex' } },
    isListVisible: true
  }));

  const startUrl = `https://www.zillow.com/homes/${status === 'sold' ? 'sold' : 'for_sale'}/?searchQueryState=${searchUrlState}`;

  const runResp = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      searchUrls: [{ url: startUrl }],
      extractionMethod: 'PAGINATION_WITH_ZOOM_IN',
      maxItems: 500
    })
  });

  if (!runResp.ok) {
    console.error('Apify run failed:', await runResp.text());
    return [];
  }

  return await runResp.json();
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
