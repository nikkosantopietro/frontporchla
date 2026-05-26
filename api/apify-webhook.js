const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const APIFY_TOKEN = process.env.APIFY_TOKEN;

module.exports = async (req, res) => {
  const { zoneId, status, token } = req.query;

  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = req.body;
    const datasetId = payload?.resource?.defaultDatasetId;

    if (!datasetId) {
      return res.status(400).json({ error: 'No dataset ID in webhook payload' });
    }

    const { data: zone } = await supabase
      .from('zones')
      .select('id, name, coordinates')
      .eq('id', zoneId)
      .single();

    if (!zone) {
      return res.status(404).json({ error: 'Zone not found' });
    }

    const coords = typeof zone.coordinates === 'string'
      ? JSON.parse(zone.coordinates)
      : zone.coordinates;

    const dataResp = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&clean=true`);
    if (!dataResp.ok) {
      return res.status(500).json({ error: 'Failed to fetch Apify dataset' });
    }
    const items = await dataResp.json();

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      if (!item.latitude || !item.longitude) {
        skipped++;
        continue;
      }

      const inZone = pointInPolygon({ lat: item.latitude, lng: item.longitude }, coords);
      if (!inZone) {
        skipped++;
        continue;
      }

      const isSold = status === 'sold' || (item.statusType || '').toLowerCase().includes('sold');

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
        status: isSold ? 'sold' : (item.statusType?.toLowerCase().includes('pending') ? 'pending' : 'for_sale'),
        listing_type: isSold ? 'sold' : 'for_sale',
        price: item.price || item.unformattedPrice,
        sold_price: isSold ? (item.price || item.unformattedPrice) : null,
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

      if (!listingData.zpid) {
        skipped++;
        continue;
      }

      const { error } = await supabase
        .from('listings')
        .upsert(listingData, { onConflict: 'zpid' });

      if (!error) inserted++;
      else skipped++;
    }

    console.log(`Webhook complete for ${zone.name} (${status}): ${inserted} inserted, ${skipped} skipped`);

    return res.status(200).json({ success: true, inserted, skipped });

  } catch (err) {
    console.error('Webhook error:', err);
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
