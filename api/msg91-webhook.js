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

    const now = new Date();

    const formattedDate1 = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);

    const formattedDate2 = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(now).replace(/\//g, '-');

    const formattedTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(now).toUpperCase().replace(/\u202f/g, ' ');

    const messageData = {
      name: data.customerName || null,
      mobile: data.customerNumber || null,
      message_body: data.text || null,
      campaign_name: data.contentType || null,
      template_name: data.templateName || null,
      created_at: now,
      date1: formattedDate1,
      date2: formattedDate2,
      time: formattedTime,
      raw_payload: payload,
      ts: data.ts,
      messages: data.messages,
      contacts: data.contacts,
      requestedAt: data.requestedAt,
      integrationNumber: data.integrationNumber,
      contentType: data.contentType,
      messageType: data.messageType,
      uuid: data.uuid
    };

    console.log('Processing webhook for mobile:', messageData.mobile);

    const { error: insertError } = await supabase
      .from('wa_reply')
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