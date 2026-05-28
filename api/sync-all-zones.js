const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  const authHeader = req.headers['authorization'];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
   // Only sync zones that have at least one active subscriber
    const { data: subs } = await supabase
      .from('subscribers')
      .select('zone_id, zones(name)')
      .eq('unsubscribed', false)
      .not('zone_id', 'is', null);

    if (!subs || subs.length === 0) {
      return res.status(200).json({ success: true, message: 'No subscribers in any zone' });
    }

    const zoneNames = [...new Set(subs.map(s => s.zones?.name).filter(Boolean))];
    const zones = zoneNames.map(name => ({ name }));

    if (zones.length === 0) {
      return res.status(200).json({ success: true, message: 'No active zones' });
    }
    const base = 'https://project-zdwup.vercel.app/api/sync-listings';
    const triggered = [];

    // Fire each zone as its own request, don't await the full scrape —
    // just kick it off so no single call hits the timeout.
    for (const zone of zones) {
      const url = `${base}?zone=${encodeURIComponent(zone.name)}`;
      fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
      }).catch(err => console.error(`Trigger failed for ${zone.name}:`, err.message));

      triggered.push(zone.name);
      // small stagger so we don't slam Apify's concurrency limit
      await new Promise(r => setTimeout(r, 1500));
    }

    return res.status(200).json({
      success: true,
      message: 'Per-zone syncs triggered',
      zones: triggered
    });

  } catch (err) {
    console.error('Orchestrator error:', err);
    return res.status(500).json({ error: err.message });
  }
};
