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

    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const agentFirstName = agent.full_name?.split(' ')[0] || 'there';
    const subscriberName = sub.first_name + ' ' + sub.last_name;
    const zoneName = sub.zones?.name || 'Unknown Zone';

    await sgMail.send({
      to: agent.reply_to_email,
      from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
      subject: 'Call ' + sub.first_name + ' ' + sub.last_name + ' today',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fdfaf7;border:1px solid #e8ddd0;border-radius:12px;overflow:hidden;">
          <div style="background:#B5652A;padding:20px 24px;">
            <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.7);">Front Porch LA</p>
            <p style="margin:6px 0 0;font-size:20px;color:#fff;font-family:Georgia,serif;">Hot lead alert</p>
          </div>
          <div style="padding:24px;">
            <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
              <tr><td style="padding:8px 0;font-size:13px;color:#9b9088;border-bottom:1px solid #e8ddd0;">Name</td><td style="padding:8px 0;font-size:13px;color:#2c2825;text-align:right;border-bottom:1px solid #e8ddd0;">${subscriberName}</td></tr>
              <tr><td style="padding:8px 0;font-size:13px;color:#9b9088;border-bottom:1px solid #e8ddd0;">Phone</td><td style="padding:8px 0;font-size:13px;color:#B5652A;text-align:right;border-bottom:1px solid #e8ddd0;">${sub.phone || '—'}</td></tr>
              <tr><td style="padding:8px 0;font-size:13px;color:#9b9088;border-bottom:1px solid #e8ddd0;">Zone</td><td style="padding:8px 0;font-size:13px;color:#2c2825;text-align:right;border-bottom:1px solid #e8ddd0;">${zoneName}</td></tr>
              <tr><td style="padding:8px 0;font-size:13px;color:#9b9088;border-bottom:1px solid #e8ddd0;">Score</td><td style="padding:8px 0;font-size:13px;color:#2c2825;text-align:right;border-bottom:1px solid #e8ddd0;">${sub.engagement_score}</td></tr>
              <tr><td style="padding:8px 0;font-size:13px;color:#9b9088;">Clicks this month</td><td style="padding:8px 0;font-size:13px;color:#2c2825;text-align:right;">${sub.monthly_clicks}</td></tr>
            </table>
            <div style="margin-bottom:20px;padding:14px;background:#fef3dc;border-radius:8px;">
              <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">When you call</p>
              <p style="margin:0;font-size:14px;color:#6b6058;font-style:italic;line-height:1.6;">"Hey ${sub.first_name}, it's ${agentFirstName} — just wanted to reach out, I noticed you've been checking out some of the market info I sent over. Anything catch your eye?"</p>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding-right:8px;"><a href="tel:${sub.phone}" style="display:block;background:#B5652A;border-radius:100px;padding:12px;text-align:center;font-size:13px;color:#fff;text-decoration:none;">Call ${sub.first_name}</a></td>
                <td style="padding-left:8px;"><a href="mailto:${sub.email}" style="display:block;background:#f2f7ee;border:1px solid #d4e8c8;border-radius:100px;padding:12px;text-align:center;font-size:13px;color:#3d5a47;text-decoration:none;">Email ${sub.first_name}</a></td>
              </tr>
            </table>
          </div>
        </div>
      `
    });

    await supabase
      .from('subscribers')
      .update({ alert_sent_this_month: true })
      .eq('id', subscriberId);

  } catch (err) {
    console.error('Hot lead alert error:', err);
  }
}
