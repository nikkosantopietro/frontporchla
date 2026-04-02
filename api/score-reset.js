const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: subscribers, error } = await supabase
      .from('subscribers')
      .select('id, opened_last_month, clicked_last_month')
      .eq('unsubscribed', false);

    if (error || !subscribers) {
      return res.status(500).json({ error: 'Failed to fetch subscribers' });
    }

    for (const sub of subscribers) {
      await supabase
        .from('subscribers')
        .update({
          engagement_score: 0,
          monthly_clicks: 0,
          alert_sent_this_month: false,
          opened_last_month: sub.opened_last_month,
          clicked_last_month: sub.clicked_last_month,
        })
        .eq('id', sub.id);
    }

    console.log(`Score reset complete for ${subscribers.length} subscribers`);
    return res.status(200).json({ success: true, reset: subscribers.length });

  } catch (err) {
    console.error('Score reset error:', err);
    return res.status(500).json({ error: err.message });
  }
};
