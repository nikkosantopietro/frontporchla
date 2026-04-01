const sgMail = require('@sendgrid/mail');
const generateEmail = require('./email-template');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { replyTo, subject, ...templateData } = req.body;

  if (!replyTo || !templateData.agentName || !templateData.zoneName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const html = generateEmail(templateData);

  try {
    await sgMail.send({
      to: templateData.to,
      from: {
        email: 'monthly@frontporchla.com',
        name: 'Front Porch LA',
      },
      replyTo: replyTo,
      subject: subject || `Your ${templateData.month} Neighborhood Report · ${templateData.zoneName}`,
      html,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SendGrid error:', err);
    return res.status(500).json({ error: err.message });
  }
};
