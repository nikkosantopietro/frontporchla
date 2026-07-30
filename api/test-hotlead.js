// api/test-hotlead.js
// Sends a sample hot-lead alert email for a subscriber so we can verify the
// format (note dates, tap-to-call phone, Maps-linked address, action buttons).
// Mirrors sendgrid-webhook's alert email.
//   GET /api/test-hotlead?secret=<CRON_SECRET>&email=<subscriber email>

const { createClient } = require('@supabase/supabase-js');
const sgMail = require('@sendgrid/mail');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function calcStatus(score) {
  if (score >= 100) return 'On Fire';
  if (score >= 51) return 'Hot';
  if (score >= 21) return 'Warm';
  return 'Cold';
}

module.exports = async (req, res) => {
  const provided = (req.query && req.query.secret) || (req.headers['authorization'] || '').replace('Bearer ', '');
  if (provided !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' });

  const email = (req.query && req.query.email) || 'nikkosantopietro@gmail.com';
  const { data: subs, error } = await supabase.from('subscribers').select('*, zones(name)').eq('email', email).limit(1);
  if (error) return res.status(500).json({ error: error.message });
  if (!subs || subs.length === 0) return res.status(404).json({ error: 'Subscriber not found', email });

  const sub = subs[0];
  const zoneName = sub.zones ? sub.zones.name : '—';

  const { data: agentData } = await supabase.from('agents').select('email, reply_to_email').eq('id', sub.agent_id).limit(1);
  const agentEmail = agentData && agentData[0] ? (agentData[0].reply_to_email || agentData[0].email) : null;
  if (!agentEmail) return res.status(400).json({ error: 'No agent email on file' });

  let notes = [];
  try { notes = sub.notes ? JSON.parse(sub.notes) : []; } catch (e) { notes = []; }
  const recentNotes = notes.slice(-5).reverse();
  const notesHtml = recentNotes.length > 0
    ? recentNotes.map(function (n) {
        var d = n.date ? new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        return '<div style="padding:8px 0;border-bottom:1px solid #ece4da;"><p style="margin:0 0 2px;font-size:10px;color:#9b9088;">' + d + '</p><p style="margin:0;font-size:13px;color:#2c2825;line-height:1.5;">' + n.text + '</p></div>';
      }).join('')
    : '<p style="margin:0;font-size:13px;color:#2c2825;">No notes yet.</p>';

  const digits = sub.phone ? String(sub.phone).replace(/\D/g, '') : '';
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  const phoneTel = ten.length === 10 ? '+1' + ten : digits;
  const phoneCell = ten.length === 10
    ? '<a href="tel:' + phoneTel + '" style="color:#b5652a;text-decoration:none;">(' + ten.slice(0, 3) + ')' + ten.slice(3, 6) + '-' + ten.slice(6) + '</a>'
    : (sub.phone || '—');

  const addressCell = sub.address
    ? '<a href="maps://?q=' + encodeURIComponent(sub.address) + '" style="color:#b5652a;text-decoration:none;">' + sub.address + '</a>'
    : '—';

  const reason = 'Test alert — verifying the hot-lead email format, note dates, tap-to-call, and the Maps link.';

  const html = `
<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:#fdfaf7;border:1px solid #e8ddd0;border-radius:12px;overflow:hidden;">
<div style="background:#b5652a;padding:20px 24px;">
<p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#ffffff;">Front Porch LA &middot; Hot Lead Alert</p>
<p style="margin:6px 0 0;font-size:22px;color:#fff;font-family:Georgia,serif;">&#128293; Call ${sub.first_name} ${sub.last_name} today</p>
</div>
<div style="padding:24px;">
<p style="margin:0 0 16px;font-size:14px;color:#6b6058;line-height:1.6;">${reason}</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
<tr><td style="padding:6px 0;font-size:13px;color:#9b9088;width:100px;">Name</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${sub.first_name} ${sub.last_name}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Address</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${addressCell}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Phone</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${phoneCell}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Zone</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${zoneName}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">Score</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#b5652a;">${sub.engagement_score || 0} — ${calcStatus(sub.engagement_score || 0)}</td></tr>
<tr><td style="padding:6px 0;font-size:13px;color:#9b9088;">This month</td><td style="padding:6px 0;font-size:13px;font-weight:500;color:#2c2825;">${sub.monthly_clicks || 0} clicks &middot; ${sub.total_opens || 0} total opens</td></tr>
</table>
<div style="background:#f7f3ee;border-radius:8px;padding:14px;margin-bottom:20px;">
<p style="margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#9b9088;">Recent notes</p>
${notesHtml}
</div>
<div style="display:flex;gap:10px;">
${sub.phone ? `<a href="tel:${phoneTel}" style="flex:1;text-align:center;background:#b5652a;color:white;padding:10px;border-radius:100px;font-size:13px;text-decoration:none;">Call ${sub.first_name}</a>` : ''}
${sub.email ? `<a href="mailto:${sub.email}?subject=${encodeURIComponent('Checking in — Front Porch LA')}" style="flex:1;text-align:center;background:#3d5a47;color:white;padding:10px;border-radius:100px;font-size:13px;text-decoration:none;">Email ${sub.first_name}</a>` : ''}
</div>
</div>
</div>`;

  await sgMail.send({
    to: agentEmail,
    from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
    replyTo: agentEmail,
    subject: 'TEST &#128293; Call ' + sub.first_name + ' ' + sub.last_name + ' today',
    html,
  });

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ sent: true, to: agentEmail, subscriber: sub.first_name + ' ' + sub.last_name, noteCount: notes.length });
};



