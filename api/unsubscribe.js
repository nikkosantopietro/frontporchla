const html = `
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
      <p style="margin:0;font-size:22px;color:#ffffff;font-family:Georgia,serif;">${subscriberName} unsubscribed</p>
    </td>
  </tr>

  <tr><td style="height:3px;background:#8ab87a;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="padding:28px 32px;border-bottom:1px solid #e8ddd0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding-bottom:16px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Name</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${subscriberName}</p>
          </td>
          <td width="50%" style="padding-bottom:16px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Zone</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${zoneName}</p>
          </td>
        </tr>
        <tr>
          <td width="50%" style="padding-bottom:16px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Phone</p>
            <p style="margin:0;font-size:15px;color:#B5652A;">${subscriber.phone || '—'}</p>
          </td>
          <td width="50%" style="padding-bottom:16px;">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Score at unsubscribe</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${subscriber.engagement_score || 0} · ${getStatus(subscriber.engagement_score)}</p>
          </td>
        </tr>
        <tr>
          <td width="50%">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Emails received</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${subscriber.emails_sent || 0}</p>
          </td>
          <td width="50%">
            <p style="margin:0 0 3px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Unsubscribed</p>
            <p style="margin:0;font-size:15px;color:#2c2825;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  ${subscriber.notes && subscriber.notes.length > 0 ? `
  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid #e8ddd0;background:#fafcf8;">
      <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Your notes</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${subscriber.notes.map(n => `
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#9b9088;vertical-align:top;width:110px;border-bottom:1px solid #f0ece8;">${new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
          <td style="padding:6px 0;font-size:13px;color:#2c2825;line-height:1.5;border-bottom:1px solid #f0ece8;">${n.text}</td>
        </tr>`).join('')}
      </table>
    </td>
  </tr>
  ` : ''}

  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid #e8ddd0;background:#fafcf8;">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">When you call</p>
      <p style="margin:0;font-size:14px;color:#6b6058;line-height:1.7;font-style:italic;font-family:Georgia,serif;">"Hey ${subscriber.first_name}, it's ${agentFirstName} — I just noticed you unsubscribed from my ${zoneName} updates. Totally fine, just wanted to make sure I wasn't sending something you didn't find useful. Is there anything I could do differently?"</p>
    </td>
  </tr>

  <tr>
    <td style="padding:24px 32px;border-bottom:1px solid #e8ddd0;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:#9b9088;">Resubscribe link · send via text or email</p>
      <p style="margin:0 0 12px;font-size:13px;color:#3d5a47;font-family:'Courier New',monospace;word-break:break-all;">${resubscribeLink}</p>
      <a href="${resubscribeLink}" style="display:inline-block;background:#f2f7ee;border:1px solid #d4e8c8;border-radius:100px;padding:8px 18px;font-size:12px;color:#3d5a47;text-decoration:none;">Copy resubscribe link</a>
    </td>
  </tr>

  <tr>
    <td style="padding:20px 32px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <a href="tel:${subscriber.phone}" style="display:block;background:#B5652A;border-radius:100px;padding:12px;text-align:center;font-size:13px;color:#fff;text-decoration:none;">Call ${subscriber.first_name}</a>
          </td>
          <td width="50%" style="padding-left:8px;">
            <a href="mailto:${subscriber.email}" style="display:block;background:#f2f7ee;border:1px solid #d4e8c8;border-radius:100px;padding:12px;text-align:center;font-size:13px;color:#3d5a47;text-decoration:none;">Email ${subscriber.first_name}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr><td style="height:3px;background:#8ab87a;font-size:0;line-height:0;">&nbsp;</td></tr>

  <tr>
    <td style="background:#1e3318;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#8ab87a;font-family:Arial,sans-serif;">Front Porch LA · The Agency Beverly Hills</p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>`;
