import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.MSG91_WEBHOOK_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {

  // 1️⃣ Allow only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {

    // 2️⃣ Simple Secret Validation
    const incomingSecret = req.headers['msg91-webhook-secret'];

    if (!incomingSecret || incomingSecret !== webhookSecret) {
      console.error('Invalid Webhook Secret');
      return res.status(401).json({ error: 'Unauthorized: Invalid Webhook Secret' });
    }

    const payload = req.body;
    const data = Array.isArray(payload) ? payload[0] : payload;

    const messageData = {
      message_id: data.messageId || data.uuid || null,
      mobile: data.mobile || data.destination || null,
      status: data.status || null,
      message_type: data.type || null,
      message_body: data.text || data.content || null,
      raw_payload: payload,
    };

    console.log('Processing webhook for message:', messageData.message_id);

    const { error: insertError } = await supabase
      .from('messages')
      .insert([messageData]);

    if (insertError) {
      console.error('Supabase Error:', insertError);
      throw new Error(insertError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    console.error('Webhook Handler Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message,
      error: 'Internal Server Error'
    });
  }
}