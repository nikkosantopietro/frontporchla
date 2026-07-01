const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');
const generateEmail = require('./email-template');
const { generateArticle } = require('./generate-article');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Helper: safely pull Zillow's nested home info out of raw_data.
// The flat columns (price, sold_price, sold_date, days_on_market, zestimate)
// are all NULL from the scraper — the real values live here.
function homeInfo(row) {
  return row?.raw_data?.hdpData?.homeInfo || {};
}

function buildZoneMapUrl(zone) {
  try {
    const coords = typeof zone.coordinates === 'string'
      ? JSON.parse(zone.coordinates)
      : zone.coordinates;
    if (!coords || coords.length === 0) return null;

    const lats = coords.map(c => c.lat);
    const lngs = coords.map(c => c.lng);
    const centerLat = ((Math.max(...lats) + Math.min(...lats)) / 2).toFixed(6);
    const centerLng = ((Math.max(...lngs) + Math.min(...lngs)) / 2).toFixed(6);

    const pathPoints = [...coords, coords[0]].map(c => c.lat.toFixed(6) + ',' + c.lng.toFixed(6)).join('|');
    const path = 'color:0x4a6741ff|weight:2|fillcolor:0x4a674140|' + pathPoints;

    return 'https://maps.googleapis.com/maps/api/staticmap' +
      '?center=' + centerLat + ',' + centerLng +
      '&zoom=14' +
      '&size=560x200' +
      '&maptype=roadmap' +
      '&style=feature:poi|visibility:off' +
      '&style=feature:transit|visibility:off' +
      '&style=feature:landscape|element:geometry|color:0xf2f7ee' +
      '&style=feature:water|element:geometry|color:0xd4e8c8' +
      '&style=feature:road|element:geometry|color:0xffffff' +
      '&style=feature:road|element:geometry.stroke|color:0xd4e8c8' +
      '&style=feature:road|element:labels.text.fill|color:0x4a6741' +
      '&path=' + encodeURIComponent(path) +
      '&key=AIzaSyDAaNEzDIZXk-tSuds24aQljvHSURJ2d2o';
  } catch (err) {
    console.error('Zone map error:', err);
    return null;
  }
}

// Calculate market stats for a zone from the listings table.
// Reads from raw_data.hdpData.homeInfo. Filters: last 12 months sold,
// excludes rentals (price >= $100k).
async function getZoneStats(zoneId) {
  const cutoffMs = Date.now() - 365 * 24 * 60 * 60 * 1000;

  const { data: sold, error: soldErr } = await supabase
    .from('listings')
    .select('raw_data')
    .eq('zone_id', zoneId)
    .eq('status', 'sold');
  if (soldErr) throw new Error('monthly-send DB error (sold): ' + soldErr.message);

  const { data: active, error: activeErr } = await supabase
    .from('listings')
    .select('raw_data')
    .eq('zone_id', zoneId)
    .eq('status', 'for_sale');
  if (activeErr) throw new Error('monthly-send DB error (active): ' + activeErr.message);

  const stats = {
    medianPrice: 'N/A',
    pricePerSqFt: 'N/A',
    homesSold: '0',
    daysOnMarket: 'N/A',
    activeListings: '0',
    marketStatus: 'Balanced Market'
  };

  // SOLD: keep only last-12-months, non-rental
  const recentSolds = (sold || []).filter(r => {
    const h = homeInfo(r);
    return h.dateSold && h.dateSold >= cutoffMs && h.price >= 100000 && h.homeType === 'SINGLE_FAMILY';
  });

  if (recentSolds.length > 0) {
    const prices = recentSolds.map(r => homeInfo(r).price).filter(p => p >= 100000).sort((a, b) => a - b);
    if (prices.length > 0) {
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
      stats.medianPrice = formatCurrency(median);
    }

    const ppsf = recentSolds
      .map(r => homeInfo(r))
      .filter(h => h.price >= 100000 && h.livingArea > 200)
      .map(h => h.price / h.livingArea);
    if (ppsf.length > 0) {
      stats.pricePerSqFt = '$' + Math.round(ppsf.reduce((a, b) => a + b, 0) / ppsf.length).toLocaleString();
    }

    stats.homesSold = recentSolds.length.toString();

    // daysOnZillow: -1 means withheld → exclude from average
    const dom = recentSolds.map(r => homeInfo(r).daysOnZillow).filter(d => d != null && d >= 0 && d < 365);
    if (dom.length > 0) {
      stats.daysOnMarket = Math.round(dom.reduce((a, b) => a + b, 0) / dom.length).toString();
    }
  }

  // ACTIVE: non-rental count
  const activeListings = (active || []).filter(r => homeInfo(r).price >= 100000 && homeInfo(r).homeType === 'SINGLE_FAMILY');
  if (activeListings.length > 0) {
    stats.activeListings = activeListings.length.toString();
  }

  const soldCount = recentSolds.length;
  const activeCount = activeListings.length;
  if (soldCount > 0 || activeCount > 0) {
    if (activeCount === 0 || soldCount / Math.max(activeCount, 1) > 1.2) {
      stats.marketStatus = "Seller's Market";
    } else if (soldCount / Math.max(activeCount, 1) < 0.6) {
      stats.marketStatus = "Buyer's Market";
    } else {
      stats.marketStatus = 'Balanced Market';
    }
  }

  return stats;
}

// Find a subscriber's home value from listings, or estimate from zone comps.
// Reads zestimate/price from raw_data.hdpData.homeInfo.
async function getSubscriberValue(sub, zoneId) {
  if (sub.address) {
    const { data: match } = await supabase
      .from('listings')
      .select('raw_data')
      .ilike('full_address', '%' + sub.address.split(',')[0] + '%')
      .limit(1);
    if (match && match.length > 0) {
      const h = homeInfo(match[0]);
      const est = h.zestimate || h.price;
      if (est) {
        return {
          estimate: est,
          low: Math.round(est * 0.92),
          high: Math.round(est * 1.08)
        };
      }
    }
  }

  const { data: zoneListings } = await supabase
    .from('listings')
    .select('raw_data')
    .eq('zone_id', zoneId);

  if (zoneListings && zoneListings.length > 0) {
    const vals = zoneListings
      .map(l => homeInfo(l).zestimate)
      .filter(v => v && v >= 100000)
      .sort((a, b) => a - b);
    if (vals.length > 0) {
      const mid = Math.floor(vals.length / 2);
      const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
      return {
        estimate: median,
        low: Math.round(median * 0.92),
        high: Math.round(median * 1.08),
        isZoneEstimate: true
      };
    }
  }

  return null;
}

module.exports = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const now = new Date();
  const month = MONTHS[now.getMonth()];
  const year = now.getFullYear().toString();

  try {
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('*');

    if (agentError || !agents) {
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }

    let totalSent = 0;
    let totalSkipped = 0;

    for (const agent of agents) {
      const { data: subscribers } = await supabase
        .from('subscribers')
        .select('*, zones(name, color, coordinates)')
        .eq('agent_id', agent.id)
        .eq('unsubscribed', false)
        .not('zone_id', 'is', null)
        .not('email', 'is', null);

      if (!subscribers || subscribers.length === 0) continue;

      const { data: unzoned } = await supabase
        .from('subscribers')
        .select('id')
        .eq('agent_id', agent.id)
        .eq('unsubscribed', false)
        .is('zone_id', null);

      const byZone = {};
      for (const sub of subscribers) {
        const zoneId = sub.zone_id;
        if (!byZone[zoneId]) {
          byZone[zoneId] = {
            zone: sub.zones,
            subscribers: []
          };
        }
        byZone[zoneId].subscribers.push(sub);
      }

      for (const zoneId of Object.keys(byZone)) {
        const { zone, subscribers: zoneSubs } = byZone[zoneId];
        const zoneMapUrl = buildZoneMapUrl(zone);

        const marketStats = await getZoneStats(zoneId);

        let article = { title: zone?.name + ' in ' + month + ': What You Need to Know', body: 'Your ' + (zone?.name || 'neighborhood') + ' market continued to show strong activity this ' + month + '.' };
        try {
          article = await generateArticle(
            zone?.name || 'Your Neighborhood',
            marketStats || {},
            month,
            year
          );
        } catch (err) {
          console.error('Article generation failed, using fallback:', err);
        }

        for (const sub of zoneSubs) {
          try {
            const value = await getSubscriberValue(sub, zoneId);

            const templateData = {
              to: sub.email,
              agentName: agent.full_name || 'Your Agent',
              agentInitials: agent.initials || 'FP',
              brokerage: agent.brokerage || 'The Agency Beverly Hills',
              zoneName: zone?.name || 'Your Neighborhood',
              month,
              year,
              medianPrice: marketStats.medianPrice,
              medianPriceChange: '—',
              pricePerSqFt: marketStats.pricePerSqFt,
              pricePerSqFtChange: '—',
              saleToList: 'N/A',
              homesSold: marketStats.homesSold,
              homesSoldChange: '—',
              daysOnMarket: marketStats.daysOnMarket,
              daysOnMarketChange: '—',
              activeListings: marketStats.activeListings,
              activeListingsChange: '—',
              marketStatus: marketStats.marketStatus,
              address: sub.address || '—',
              avmEstimate: value?.estimate ? formatCurrency(value.estimate) : 'N/A',
              avmLow: value?.low ? formatCurrency(value.low) : 'N/A',
              avmHigh: value?.high ? formatCurrency(value.high) : 'N/A',
              avmChange: '—',
              articleTitle: article.title,
              articleBody: article.body,
              listingsUrl: 'https://frontporchla.com',
              homeValueUrl: 'https://frontporchla.com/home-value.html',
              contactUrl: `mailto:${agent.reply_to_email || agent.email}`,
              unsubscribeUrl: `https://frontporchla.com/unsubscribe?email=${encodeURIComponent(sub.email)}`,
              agentId: agent.id,
              subscriberId: sub.id,
              zoneMapUrl: zoneMapUrl,
            };

            const html = generateEmail(templateData);

            await sgMail.send({
              to: sub.email,
              from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
              replyTo: agent.reply_to_email || agent.email,
              subject: `Your ${month} Neighborhood Report · ${zone?.name || 'Your Area'}`,
              html,
            });

            await supabase
              .from('subscribers')
              .update({
                emails_sent: (sub.emails_sent || 0) + 1,
                opened_last_month: false,
                clicked_last_month: false,
                monthly_clicks: 0,
                alert_sent_this_month: false,
              })
              .eq('id', sub.id);

            totalSent++;
            await new Promise(r => setTimeout(r, 100));

          } catch (err) {
            console.error(`Failed to send to ${sub.email}:`, err);
            totalSkipped++;
          }
        }
      }

      const skippedCount = unzoned?.length || 0;
      await sendAgentConfirmation(agent, totalSent, skippedCount, month, year);
    }

    return res.status(200).json({
      success: true,
      sent: totalSent,
      skipped: totalSkipped
    });

  } catch (err) {
    console.error('Monthly send error:', err);
    return res.status(500).json({ error: err.message });
  }
};

async function sendAgentConfirmation(agent, sent, skipped, month, year) {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fdfaf7;border:1px solid #e8ddd0;border-radius:12px;overflow:hidden;">
      <div style="background:#3d5a47;padding:20px 24px;">
        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b8d4a8;">Front Porch LA</p>
        <p style="margin:6px 0 0;font-size:22px;color:#fff;font-family:Georgia,serif;">✅ ${month} reports sent</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;color:#6b6058;line-height:1.6;">Your monthly neighborhood reports have been delivered. Here's a summary:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 0;font-size:13px;color:#9b9088;border-bottom:1px solid #e8ddd0;">Emails sent</td><td style="padding:8px 0;font-size:13px;font-weight:500;color:#2c2825;text-align:right;border-bottom:1px solid #e8ddd0;">${sent}</td></tr>
          <tr><td style="padding:8px 0;font-size:13px;color:#9b9088;">Skipped (no zone)</td><td style="padding:8px 0;font-size:13px;font-weight:500;color:${skipped > 0 ? '#854F0B' : '#2c2825'};text-align:right;">${skipped}</td></tr>
        </table>
        ${skipped > 0 ? `<div style="background:#fef3dc;border-radius:8px;padding:14px;margin-bottom:16px;"><p style="margin:0;font-size:13px;color:#854F0B;">⚠️ ${skipped} subscriber${skipped > 1 ? 's were' : ' was'} skipped because their address isn't covered by any of your zones. <a href="https://frontporchla.com/zones" style="color:#854F0B;font-weight:600;">Draw a zone →</a></p></div>` : ''}
        <a href="https://frontporchla.com/subscribers" style="display:block;text-align:center;background:#3d5a47;color:white;padding:12px;border-radius:100px;font-size:13px;text-decoration:none;">View your subscribers →</a>
      </div>
    </div>
  `;

  await sgMail.send({
    to: agent.reply_to_email || agent.email,
    from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
    subject: `✅ Your ${month} ${year} reports were sent`,
    html,
  });
}

function formatCurrency(num) {
  if (!num) return 'N/A';
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K';
  return '$' + Math.round(num).toLocaleString();
}
