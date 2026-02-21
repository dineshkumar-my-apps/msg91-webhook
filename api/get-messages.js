import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.MSG91_WEBHOOK_SECRET;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export default async function handler(req, res) {
    // 1️⃣ Allow only GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }

    try {
        // 2️⃣ Simple Secret Validation (Consistency with webhook)
        const incomingSecret = req.headers['msg91-webhook-secret'];
        if (!incomingSecret || incomingSecret !== webhookSecret) {
            return res.status(401).json({ error: 'Unauthorized: Invalid Secret' });
        }

        // 3️⃣ Extract Filters
        const { start_date, end_date, mobile, template_name } = req.query;

        let query = supabase
            .from('wa_reply')
            .select('*')
            .order('created_at', { ascending: false });

        // 4️⃣ Apply Filters
        if (start_date) {
            query = query.gte('date1', start_date);
        }
        if (end_date) {
            query = query.lte('date1', end_date);
        }
        if (mobile) {
            query = query.ilike('mobile', `%${mobile}%`);
        }
        if (template_name) {
            query = query.eq('template_name', template_name);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return res.status(200).json({
            success: true,
            count: data.length,
            data: data
        });

    } catch (error) {
        console.error('API Error:', error.message);
        return res.status(500).json({
            success: false,
            message: error.message,
            error: 'Internal Server Error'
        });
    }
}
