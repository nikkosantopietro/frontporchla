const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const LINK_SCORES = {
  'capital-gains': 25,
  'home-value': 15,
  'listings': 10,
  'contact': 20,
  'mortgage': 15
};

module.exports = async function handler(req, res) {
  const { sid, lid, dest } = req.query;

  if (!dest) {
    return res.status(400).send('Missing destination');
  }

  const destination = decodeURIComponent(dest);

  try {
    if (sid && lid) {
      const { data: subscriber } = await supabase
        .from('subscribers')
        .select('id, agent_id, zone_id, engagement_score, monthly_clicks, return_visit_count, alert_sent_this_month')
        .eq('id', sid)
        .single();

      if (subscriber) {
        await supabase
          .from('link_clicks')
          .insert({
            subscriber_id: subscriber.id,
            agent_id: subscriber.agent_id,
            zone_id: subscriber.zone_id,
            link_key: lid,
            destination: destination
          });

        const linkScore = LINK_SCORES[lid] || 10;
        const newScore = (subscriber.engagement_score || 0) + linkScore;
        const newClicks = (subscriber.monthly_clicks || 0) + 1;

        await supabase
          .from('subscribers')
          .update({
            engagement_score: newScore,
            monthly_clicks: newClicks,
            clicked_last_month: true
          })
          .eq('id', subscriber.id);

        const prevScore = subscriber.engagement_score || 0;
        const shouldAlert =
          !subscriber.alert_sent_this_month && (
            (prevScore < 75 && newScore >= 75) ||
            newClicks >= 3 ||
            (newScore - prevScore) >= 30
          );

        if (shouldAlert) {
          await triggerHotLeadAlert(subscriber.id);
        }
      }
    }
  } catch (err) {
    console.error('Track error:', err);
  }

  return res.redirect(302, destination);
};

async function triggerHotLeadAlert(subscriberId) {
  try {
    const { data: sub } = await supabase
      .from('subscribers')
      .select('*, zones(name)')
      .eq('id', subscriberId)
      .single();

    if (!sub) return;

    const { data: agent } = await supabase
      .from('agents')
      .select('full_name, reply_to_email, initials')
      .eq('id', sub.agent_id)
      .single();

    if (!agent) return;

    const { data: clicks } = await supabase
      .from('link_clicks')
      .select('link_key, destination, created_at')
      .eq('subscriber_id', subscriberId)
      .order('created_at', { ascending: false })
      .limit(10);

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const agentFirstName = agent.full_name?.split(' ')[0] || 'there';
    const subscriberName = sub.first_name + ' ' + sub.last_name;
    const zoneName = sub.zones?.name || 'Unknown Zone';

    const LINK_LABELS = {
      'capital-gains': 'Capital gains calculator',
      'home-value': 'How is my home valued?',
      'home-value-tool': 'Home value page',
      'listings': 'View listings',
      'contact': 'Get in touch',
      'mortgage': 'Mortgage calculator'
    };

    const LINK_SCORES = {
      'capital-gains': 25,
      'home-value': 15,
      'home-value-tool': 15,
      'listings': 10,
      'contact': 20,
      'mortgage': 15
    };

    const clickRowsHtml = clicks && clicks.length > 0
      ? clicks.map(c => {
          const label = LINK_LABELS[c.link_key] || c.link_key;
          const pts = LINK_SCORES[c.link_key] || 10;
          const date = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const time = new Date(c.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          return `
            <tr>
              <td style="padding:7px 0;font-size:13px;color:#2c2825;border-bottom:1px solid #f0ece8;">${label}</td>
              <td style="padding:7px 0;font-size:12px;color:#9b9088;border-bottom:1px solid #f0ece8;">${date} · ${time}</td>
              <td style="padding:7px 0;text-align:right;border-bottom:1px solid #f0ece8;"><span style="font-size:11px;font-weight:500;color:#3d5a47;background:#ebf0ec;padding:2px 8px;border-radius:100px;">+${pts} pts</span></td>
            </tr>`;
        }).join('')
      : '<tr><td colspan="3" style="padding:8px 0;font-size:13px;color:#9b9088;">No clicks recorded yet</td></tr>';

    const topClick = clicks && clicks.length > 0 ? clicks[0].link_key : null;
    const callScript = topClick === 'capital-gains'
      ? '"Hey ' + sub.first_name + ', it\'s ' + agentFirstName + ' — I just noticed you unsubscribed from my ' + zoneName + ' updates. Totally fine, just wanted to make sure I wasn\'t sending something you didn\'t find useful. Is there anything I could do differently?"'
      : '"Hey ' + sub.first_name + ', it\'s ' + agentFirstName + ' — I just noticed you unsubscribed from my ' + zoneName + ' updates. Totally fine, just wanted to make sure I wasn\'t sending something you didn\'t find useful. Is there anything I could do differently?"';

    await sgMail.send({
      to: agent.reply_to_email,
      from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
      subject: 'Call ' + sub.first_name + ' ' + sub.last_name + ' today',
      html: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0f4ee;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ee;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">

  <tr>
    <td style="background:#3d5a47;padding:24px 32px;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b8d4a8;">Front Porch LA</p>
      <p style="margin:0;font-size:22px;color:#ffffff;font-family:Georgia,serif;">Call ${sub.first_name} ${sub.last_name} today</p>
    </td>
  </tr>

  <tr><td style="height:3px;background:#8ab87a;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid #e8ddd0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding-bottom:14px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Name</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${subscriberName}</p>
          </td>
          <td width="50%" style="padding-bottom:14px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Zone</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${zoneName}</p>
          </td>
        </tr>
        <tr>
          <td width="50%">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Phone</p>
            <p style="margin:0;font-size:15px;color:#B5652A;">${sub.phone || '—'}</p>
          </td>
          <td width="50%">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Score</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${sub.engagement_score} · ${getStatus(sub.engagement_score)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid #e8ddd0;background:#fafcf8;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">What she clicked</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${clickRowsHtml}
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid #e8ddd0;">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">When you call</p>
      <p style="margin:0;font-size:14px;color:#6b6058;line-height:1.7;font-style:italic;font-family:Georgia,serif;">${callScript}</p>
    </td>
  </tr>

  <tr>
    <td style="padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <a href="tel:${sub.phone}" style="display:block;background:#B5652A;border-radius:100px;padding:12px;text-align:center;font-size:13px;color:#fff;text-decoration:none;">Call ${sub.first_name}</a>
          </td>
          <td width="50%" style="padding-left:8px;">
            <a href="mailto:${sub.email}" style="display:block;background:#f2f7ee;border:1px solid #d4e8c8;border-radius:100px;padding:12px;text-align:center;font-size:13px;color:#3d5a47;text-decoration:none;">Email ${sub.first_name}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="height:3px;background:#8ab87a;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="background:#1e3318;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#8ab87a;">Front Porch LA · The Agency Beverly Hills</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`
    });

    await supabase
      .from('subscribers')
      .update({ alert_sent_this_month: true })
      .eq('id', subscriberId);

  } catch (err) {
    console.error('Hot lead alert error:', err);
  }
}

function getStatus(score) {
  if (!score || score <= 20) return 'Cold';
  if (score <= 50) return 'Warm';
  if (score <= 99) return 'Hot';
  return 'On Fire';
}
