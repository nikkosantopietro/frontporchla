import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });

  try {
    const { data: subscriber, error } = await supabase
      .from('subscribers')
      .update({
        unsubscribed: false,
        unsubscribed_at: null
      })
      .eq('email', email)
      .select()
      .single();

    if (error || !subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Resubscribe error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
