const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');
const generateEmail = require('./email-template');
const { getAVM, getMarketStats, getZipFromAddress } = require('./attom');
const { generateArticle } = require('./generate-article');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
        .select('*, zones(name, color)')
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
        const zoneMapUrl = buildZoneMapUrl(zone);

        const sampleAddress = zoneSubs[0]?.address;
        const zip = getZipFromAddress(sampleAddress);
        const marketStats = zip ? await getMarketStats(zip) : null;

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
            const avm = sub.address ? await getAVM(sub.address) : null;

            const templateData = {
              to: sub.email,
              agentName: agent.full_name || 'Your Agent',
              agentInitials: agent.initials || 'FP',
              brokerage: agent.brokerage || 'The Agency Beverly Hills',
              zoneName: zone?.name || 'Your Neighborhood',
              month,
              year,
              medianPrice: marketStats?.medianPrice || 'N/A',
              medianPriceChange: '—',
              pricePerSqFt: marketStats?.pricePerSqFt || 'N/A',
              pricePerSqFtChange: '—',
              saleToList: marketStats?.saleToList || 'N/A',
              homesSold: marketStats?.homesSold?.toString() || 'N/A',
              homesSoldChange: '—',
              daysOnMarket: marketStats?.daysOnMarket || 'N/A',
              daysOnMarketChange: '—',
              activeListings: 'N/A',
              activeListingsChange: '—',
              marketStatus: marketStats?.saleToList && parseInt(marketStats.saleToList) >= 100 ? "Seller's Market" : "Buyer's Market",
              address: sub.address || '—',
              avmEstimate: avm?.estimate ? formatCurrency(avm.estimate) : 'N/A',
              avmLow: avm?.low ? formatCurrency(avm.low) : 'N/A',
              avmHigh: avm?.high ? formatCurrency(avm.high) : 'N/A',
              avmChange: avm?.change ? (avm.change > 0 ? '↑ ' : '↓ ') + formatCurrency(Math.abs(avm.change)) : '—',
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
