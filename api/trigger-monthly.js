const monthlySend = require('./monthly-send');

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    return res.status(200).end();
  }

  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  
  const token = req.headers['x-agent-token'];
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.headers['authorization'] = `Bearer ${process.env.CRON_SECRET}`;
  return monthlySend(req, res);
};
