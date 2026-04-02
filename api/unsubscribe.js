import { createClient } from '@supabase/supabase-js';
import sgMail from '@sendgrid/mail';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const { data: subscriber, error: fetchError } = await supabase
      .from('subscribers')
      .select('*, zones(name)')
      .eq('email', email)
      .single();

    if (fetchError || !subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    await supabase
      .from('subscribers')
      .update({
        unsubscribed: true,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email', email);

    const { data: agent } = await supabase
      .from('agents')
      .select('full_name, reply_to_email, initials')
      .eq('id', subscriber.agent_id)
      .single();

    const agentFirstName = agent?.full_name?.split(' ')[0] || 'there';
    const agentEmail = agent?.reply_to_email || 'nikkosantopietro@gmail.com';
    const agentInitials = agent?.initials || 'NS';
    const subscriberName = `${subscriber.first_name} ${subscriber.last_name}`;
    const zoneName = subscriber.zones?.name || 'Unknown Zone';
    const resubscribeLink = `https://frontporchla.com/resubscribe.html?email=${encodeURIComponent(email)}`;

    const notes = Array.isArray(subscriber.notes) && subscriber.notes.length > 0
      ? subscriber.notes.map(n => `<tr><td style="padding:6px 0;font-size:13px;color:#9B9088;vertical-align:top;width:100px;">${new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td><td style="padding:6px 0;font-size:13px;color:#E8DDD0;">${n.text}</td></tr>`).join('')
      : '<tr><td colspan="2" style="font-size:13px;color:#9B9088;padding:6px 0;">No notes</td></tr>';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#1a1a1a;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#2C2825;border-radius:12px;overflow:hidden;">

  <tr>
    <td style="background:#B5652A;padding:20px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="48">
            <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:500;color:#fff;text-align:center;line-height:40px;">${agentInitials}</div>
          </td>
          <td style="padding-left:12px;">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.65);letter-spacing:0.08em;text-transform:uppercase;">Front Porch LA</p>
            <p style="margin:0;font-size:16px;color:#fff;font-weight:500;">${subscriberName} unsubscribed</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 28px;">

      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border-radius:10px;padding:18px 20px;margin-bottom:20px;">
        <tr>
          <td width="50%" style="padding:0 0 14px;">
            <p style="margin:0 0 2px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Name</p>
            <p style="margin:0;font-size:15px;color:#F7F3EE;">${subscriberName}</p>
          </td>
          <td width="50%" style="padding:0 0 14px;">
            <p style="margin:0 0 2px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Zone</p>
            <p style="margin:0;font-size:15px;color:#F7F3EE;">${zoneName}</p>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding:0 0 14px;">
            <p style="margin:0 0 2px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Phone</p>
            <p style="margin:0;font-size:15px;color:#C4A882;">${subscriber.phone || '—'}</p>
          </td>
          <td width="50%" style="padding:0 0 14px;">
            <p style="margin:0 0 2px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Score at unsubscribe</p>
            <p style="margin:0;font-size:15px;color:#F7F3EE;">${subscriber.engagement_score || 0} · ${getStatus(subscriber.engagement_score)}</p>
          </td>
        </tr>
        <tr>
          <td width="50%">
            <p style="margin:0 0 2px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Emails received</p>
            <p style="margin:0;font-size:15px;color:#F7F3EE;">${subscriber.emails_sent || 0}</p>
          </td>
          <td width="50%">
            <p style="margin:0 0 2px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Unsubscribed</p>
            <p style="margin:0;font-size:15px;color:#F7F3EE;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-left:3px solid #B5652A;padding-left:16px;margin-bottom:20px;">
        <tr>
          <td>
            <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">When you call</p>
            <p style="margin:0;font-size:14px;color:#E8DDD0;line-height:1.6;font-style:italic;">"Hey ${subscriber.first_name}, it's ${agentFirstName} — I just noticed you unsubscribed from my ${zoneName} updates. Totally fine, just wanted to make sure I wasn't sending something you didn't find useful. Is there anything I could do differently?"</p>
          </td>
        </tr>
      </table>

      ${subscriber.notes && subscriber.notes.length > 0 ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border-radius:10px;padding:14px 16px;margin-bottom:20px;">
        <tr><td><p style="margin:0 0 10px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Your notes</p></td></tr>
        ${notes}
      </table>
      ` : ''}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px;margin-bottom:20px;">
        <tr>
          <td>
            <p style="margin:0 0 6px;font-size:11px;color:rgba(255,255,255,0.45);text-transform:uppercase;letter-spacing:0.07em;">Copy resubscribe link · send via text or email</p>
            <p style="margin:0;font-size:13px;color:#C4A882;font-family:'Courier New',monospace;word-break:break-all;">${resubscribeLink}</p>
          </td>
        </tr>
      </table>

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding-right:6px;">
            <a href="tel:${subscriber.phone}" style="display:block;background:#B5652A;border-radius:8px;padding:12px;text-align:center;font-size:13px;font-weight:500;color:#fff;text-decoration:none;">Call ${subscriber.first_name}</a>
          </td>
          <td width="50%" style="padding-left:6px;">
            <a href="mailto:${subscriber.email}" style="display:block;background:rgba(255,255,255,0.08);border-radius:8px;padding:12px;text-align:center;font-size:13px;font-weight:500;color:#E8DDD0;text-decoration:none;">Email ${subscriber.first_name}</a>
          </td>
        </tr>
      </table>

    </td>
  </tr>

  <tr>
    <td style="padding:14px 28px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
      <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);">Front Porch LA · The Agency Beverly Hills</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    await sgMail.send({
      to: agentEmail,
      from: { email: 'monthly@frontporchla.com', name: 'Front Porch LA' },
      replyTo: agentEmail,
      subject: `${subscriberName} unsubscribed · ${zoneName}`,
      html
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Unsubscribe error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

function getStatus(score) {
  if (!score || score <= 20) return 'Cold';
  if (score <= 50) return 'Warm';
  if (score <= 99) return 'Hot';
  return 'On Fire';
}
