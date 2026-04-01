const sgMail = require('@sendgrid/mail');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, html' });
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  try {
    await sgMail.send({
      to,
      from: {
        email: 'hello@frontporchla.com',
        name: 'Front Porch LA',
      },
      subject,
      html,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SendGrid error:', err);
    return res.status(500).json({ error: err.message });
  }
};
