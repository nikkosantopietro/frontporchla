const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const APIFY_TOKEN = process.env.APIFY_TOKEN;

module.exports = async (req, res) => {
  if (req.query.token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const datasetId = req.query.datasetId;
  const zoneId = req.query.zoneId;
  if (!datasetId || !zoneId) {
    return res.status(400).json({ error: 'Need datasetId and zoneId' });
  }

  try {
    const { data: zone } = await supabase
      .from('zones').select('id, name, coordinates').eq('id', zoneId).single();
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const coords = typeof zone.coordinates === 'string' ? JSON.parse(zone.coordinates) : zone.coordinates;

    const resp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`);
    const items = await resp.json();

    let inserted = 0, skipped = 0;
    if (items.length > 0) {
     console.log('SAMPLE KEYS:', Object.keys(items[0]).join(', '));
     console.log('SAMPLE LATLNG:', items[0].latitude, items[0].longitude);
   }
    for (const item of items) {
      const lat = item.latLong?.latitude;
      const lng = item.latLong?.longitude;
      if (skipped < 2 && inserted < 2) {
        console.log('CHECK:', lat, lng, 'inZone:', pointInPolygon({ lat, lng }, coords));
        console.log('ZONE COORDS SAMPLE:', JSON.stringify(coords).substring(0, 300));
      }
      if (!lat || !lng) { skipped++; continue; }
      if (!pointInPolygon({ lat, lng }, coords)) { skipped++; continue; }

      const isSold = (item.statusType || '').toLowerCase().includes('sold');
      const row = {
        zpid: item.zpid?.toString(),
        detail_url: item.detailUrl,
        street_address: item.addressStreet,
        city: item.addressCity,
        state: item.addressState,
        zip: item.addressZipcode,
        full_address: item.address,
        latitude: lat,
        longitude: lng,
        status: isSold ? 'sold' : 'for_sale',
        listing_type: isSold ? 'sold' : 'for_sale',
       price: item.unformattedPrice,
        sold_price: item.soldPrice || (isSold ? item.unformattedPrice : null),
        zestimate: item.zestimate,
        rent_zestimate: item.rentZestimate,
        beds: item.beds,
        baths: item.baths,
        sqft: item.area,
        year_built: item.yearBuilt,
        home_type: item.hdpData?.homeInfo?.homeType,
        days_on_market: item.daysOnZillow,
        primary_photo: item.imgSrc,
        zone_id: zone.id,
        raw_data: item,
        updated_at: new Date().toISOString()
      };
      if (!row.zpid) { skipped++; continue; }
      const { error } = await supabase.from('listings').upsert(row, { onConflict: 'zpid' });
      if (!error) inserted++; else { skipped++; console.error(error); }
    }

    return res.status(200).json({ success: true, inserted, skipped, total: items.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

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
