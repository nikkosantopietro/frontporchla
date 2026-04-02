const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');
const generateEmail = require('./email-template');
const { getAVM, getMarketStats, getZipFromAddress } = require('./attom');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

module.exports = async (req, res) => {
  // Allow manual trigger with secret or cron
 const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  console.log('Auth header:', authHeader, 'Expected:', `Bearer ${cronSecret}`);
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized', received: authHeader, expected: `Bearer ${cronSecret}` });
  }

  const now = new Date();
  const month = MONTHS[now.getMonth()];
  const year = now.getFullYear().toString();

  try {
    // Get all agents
    const { data: agents, error: agentError } = await supabase
      .from('agents')
      .select('*');

    if (agentError || !agents) {
      return res.status(500).json({ error: 'Failed to fetch agents' });
    }

    let totalSent = 0;
    let totalSkipped = 0;

    for (const agent of agents) {
      // Get all subscribers for this agent with a zone
      const { data: subscribers } = await supabase
        .from('subscribers')
        .select('*, zones(name, color)')
        .eq('agent_id', agent.id)
        .not('zone_id', 'is', null)
        .not('email', 'is', null);

      if (!subscribers || subscribers.length === 0) continue;

      // Get subscribers without a zone (for skip notification)
      const { data: unzoned } = await supabase
        .from('subscribers')
        .select('id')
        .eq('agent_id', agent.id)
        .is('zone_id', null);

      // Group subscribers by zone
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

      // For each zone, fetch market stats once
      for (const zoneId of Object.keys(byZone)) {
        const { zone, subscribers: zoneSubs } = byZone[zoneId];

        // Get market stats from first subscriber's zip
        const sampleAddress = zoneSubs[0]?.address;
        const zip = getZipFromAddress(sampleAddress);
        const marketStats = zip ? await getMarketStats(zip) : null;

        // Send to each subscriber in zone
        for (const sub of zoneSubs) {
          try {
            // Get AVM for this subscriber's specific address
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
              saleToList: 'N/A',
              homesSold: marketStats?.homesSold?.toString() || 'N/A',
              homesSoldChange: '—',
              daysOnMarket: 'N/A',
              daysOnMarketChange: '—',
              activeListings: 'N/A',
              activeListingsChange: '—',
              marketStatus: "Seller's Market",
              address: sub.address || '—',
              avmEstimate: avm?.estimate ? formatCurrency(avm.estimate) : 'N/A',
              avmLow: avm?.low ? formatCurrency(avm.low) : 'N/A',
              avmHigh: avm?.high ? formatCurrency(avm.high) : 'N/A',
              avmChange: avm?.change ? (avm.change > 0 ? '↑ ' : '↓ ') + formatCurrency(Math.abs(avm.change)) : '—',
              articleTitle: `${zone?.name || 'Your Neighborhood'} in ${month}: What You Need to Know`,
              articleBody: `Your ${zone?.name || 'neighborhood'} market continued to show strong activity this ${month}. Stay tuned for more detailed insights as we gather more data for your specific area.`,
              listingsUrl: 'https://frontporchla.com',
              homeValueUrl: 'https://frontporchla.com/home-value.html',
              contactUrl: `mailto:${agent.reply_to_email || agent.email}`,
              unsubscribeUrl: 'https://frontporchla.com/unsubscribe.html',
            };

            const html = generateEmail(templateData);

            await sgMail.send({
              to: sub.email,
              from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
              replyTo: agent.reply_to_email || agent.email,
              subject: `Your ${month} Neighborhood Report · ${zone?.name || 'Your Area'}`,
              html,
            });

            // Update subscriber stats
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

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 100));

          } catch (err) {
            console.error(`Failed to send to ${sub.email}:`, err);
            totalSkipped++;
          }
        }
      }

      // Send confirmation email to agent
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
        ${skipped > 0 ? `<div style="background:#fef3dc;border-radius:8px;padding:14px;margin-bottom:16px;"><p style="margin:0;font-size:13px;color:#854F0B;">⚠️ ${skipped} subscriber${skipped > 1 ? 's were' : ' was'} skipped because their address isn't covered by any of your zones. <a href="https://frontporchla.com/zones.html" style="color:#854F0B;font-weight:600;">Draw a zone →</a></p></div>` : ''}
        <a href="https://frontporchla.com/subscribers.html" style="display:block;text-align:center;background:#3d5a47;color:white;padding:12px;border-radius:100px;font-size:13px;text-decoration:none;">View your subscribers →</a>
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
