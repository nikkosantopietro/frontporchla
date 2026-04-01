const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const SCORE_OPEN = 5;
const SCORE_CLICK = 15;
const SCORE_CLICK_DOUBLE_BONUS = 10;
const SCORE_OPEN_STREAK_BONUS = 20;
const SCORE_CLICK_STREAK_BONUS = 40;
const SCORE_NO_OPEN_PENALTY = -5;
const HOT_ALERT_THRESHOLD = 60;

function calcStatus(score) {
  if (score >= 100) return '🔥 On Fire';
  if (score >= 51) return 'Hot';
  if (score >= 21) return 'Warm';
  return 'Cold';
}

async function sendHotLeadAlert(sub, agentEmail, reason) {
  let notes = [];
  try { notes = sub.notes ? JSON.parse(sub.notes) : []; } catch(e) { notes = []; }
  const lastNote = notes.length > 0 ? notes[notes.length - 1].text : 'No notes yet.';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fdfaf7;border:1px solid #e8ddd0;border-radius:12px;overflow:hidden;">
      <div style="background:#b5652a;padding:20px 24px;">
        <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#fde8d4;">Front Porch LA · Hot Lead Alert</p>
        <p style="margin:6px 0 0;font-size:22px;color:#fff;font-family:Georgia,serif;">🔥 Call ${sub.first_name} ${sub.last_name} today</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;color:#6b6058;line-height:1.6;">${reason}</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:6px 0;font-size:13px;color:#9b9088;width:100px;">Name</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${sub.first_name} ${sub.last_name}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Address</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${sub.address || '—'}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Phone</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${sub.phone || '—'}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Zone</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${sub.zone_name || '—'}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Score</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#b5652a;">${sub.engagement_score} — ${calcStatus(sub.engagement_score)}</td></tr>
          <tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">This month</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${sub.monthly_clicks || 0} clicks · ${sub.total_opens || 0} total opens</td></tr>
        </table>
        <div style="background:#f7f3ee;border-radius:8px;padding:14px;margin-bottom:20px;">
          <p style="margin:0 0 4px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9b9088;">Your notes</p>
          <p style="margin:0;font-size:13px;color:#2c2825;line-height:1.6;">${lastNote}</p>
        </div>
        <div style="display:flex;gap:10px;">
          ${sub.phone ? `<a href="tel:${sub.phone}" style="flex:1;text-align:center;background:#b5652a;color:white;padding:10px;border-radius:100px;font-size:13px;text-decoration:none;">Call ${sub.first_name}</a>` : ''}
          ${sub.email ? `<a href="https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(sub.email)}&su=${encodeURIComponent('Checking in — Front Porch LA')}" style="flex:1;text-align:center;background:#3d5a47;color:white;padding:10px;border-radius:100px;font-size:13px;text-decoration:none;">Email ${sub.first_name}</a>` : ''}
        </div>
      </div>
    </div>
  `;

  await sgMail.send({
    to: agentEmail,
    from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
    replyTo: agentEmail,
    subject: `🔥 Call ${sub.first_name} ${sub.last_name} today`,
    html,
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const events = req.body;
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  for (const event of events) {
    const email = event.email;
    const eventType = event.event;

    if (!email || !['open', 'click'].includes(eventType)) continue;

    // Find subscriber by email
    const { data: subs, error: subError } = await supabase
      .from('subscribers')
      .select('*, zones(name)')
      .eq('email', email)
      .limit(1);

    if (subError || !subs || subs.length === 0) continue;

    const sub = subs[0];
    const prevScore = sub.engagement_score || 0;
    let scoreDelta = 0;
    let updates = {};
    let alertReason = null;

    if (eventType === 'open') {
      scoreDelta += SCORE_OPEN;
      updates.total_opens = (sub.total_opens || 0) + 1;

      // Streak bonus: opened last month too
      if (sub.opened_last_month) {
        scoreDelta += SCORE_OPEN_STREAK_BONUS;
      }
      updates.opened_last_month = true;
    }

    if (eventType === 'click') {
      scoreDelta += SCORE_CLICK;
      const newClicks = (sub.monthly_clicks || 0) + 1;
      updates.monthly_clicks = newClicks;
      updates.total_opens = (sub.total_opens || 0) + 1;

      // Double click bonus
      if (newClicks === 2) {
        scoreDelta += SCORE_CLICK_DOUBLE_BONUS;
      }

      // Click streak bonus
      if (sub.clicked_last_month) {
        scoreDelta += SCORE_CLICK_STREAK_BONUS;
      }
      updates.clicked_last_month = true;

      // Alert: 3+ clicks in a month
      if (newClicks >= 3 && !sub.alert_sent_this_month) {
        alertReason = `${sub.first_name} just clicked your ${sub.zones ? sub.zones.name : ''} report for the ${newClicks === 3 ? 'third' : newClicks + 'th'} time this month.`;
      }
    }

    const newScore = Math.max(0, prevScore + scoreDelta);
    updates.engagement_score = newScore;
    updates.last_contacted = new Date().toISOString();

    // Alert: score crosses 60 for first time
    if (prevScore < HOT_ALERT_THRESHOLD && newScore >= HOT_ALERT_THRESHOLD && !sub.alert_sent_this_month) {
      alertReason = `${sub.first_name}'s engagement score just crossed ${HOT_ALERT_THRESHOLD} for the first time — they're heating up.`;
    }

    // Alert: score jumped 30+ points in one event
    if (scoreDelta >= 30 && !sub.alert_sent_this_month) {
      alertReason = `${sub.first_name}'s score jumped ${scoreDelta} points in a single session — unusually high engagement.`;
    }

    // Update subscriber
    await supabase
      .from('subscribers')
      .update(updates)
      .eq('id', sub.id);

    // Send hot lead alert if triggered
    if (alertReason) {
      // Get agent email
      const { data: agentData } = await supabase
        .from('agents')
        .select('email, reply_to_email')
        .eq('id', sub.agent_id)
        .limit(1);

      const agentEmail = agentData && agentData.length > 0
        ? (agentData[0].reply_to_email || agentData[0].email)
        : null;

      if (agentEmail) {
        const subWithZone = { ...sub, ...updates, zone_name: sub.zones ? sub.zones.name : null };
        await sendHotLeadAlert(subWithZone, agentEmail, alertReason);

        // Mark alert sent this month
        await supabase
          .from('subscribers')
          .update({ alert_sent_this_month: true })
          .eq('id', sub.id);
      }
    }
  }

  return res.status(200).json({ received: true });
};
