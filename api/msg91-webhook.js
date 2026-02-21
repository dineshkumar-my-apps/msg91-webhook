import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const msg91WebhookSecret = process.env.MSG91_WEBHOOK_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

/**
 * Validates the MSG91 webhook signature.
 * @param {string} signature - The signature from x-msg91-signature header.
 * @param {object} body - The raw request body.
 * @returns {boolean}
 */
function validateSignature(signature, body) {
  if (!msg91WebhookSecret) {
    console.warn('MSG91_WEBHOOK_SECRET is not set. Skipping signature validation.');
    return true; // Or false depending on how strict you want to be when env var is missing
  }

  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', msg91WebhookSecret);
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  const calculatedSignature = hmac.update(bodyString).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(calculatedSignature));
}

export default async function handler(req, res) {
  // 1. Accept only POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const signature = req.headers['x-msg91-signature'];
    const payload = req.body;

    // 2. Validate MSG91 signature header (if provided or required)
    if (msg91WebhookSecret && !validateSignature(signature, payload)) {
      console.error('Invalid MSG91 signature');
      return res.status(401).json({ error: 'Unauthorized: Invalid Signature' });
    }

    // 3. Extract fields safely from MSG91 payload
    // MSG91 payload structure can vary, but based on common patterns:
    // Some payloads might be in an array or nested
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

    // 4. Save webhook data into Supabase
    const { error: insertError } = await supabase
      .from('messages')
      .insert([messageData]);

    if (insertError) {
      console.error('Supabase Error:', insertError);
      throw new Error(`Failed to save to database: ${insertError.message}`);
    }

    // 5. Return success
    return res.status(200).json({ success: true, message: 'Webhook processed successfully' });

  } catch (error) {
    console.error('Webhook Handler Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
