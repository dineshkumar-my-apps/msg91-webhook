## Project Structure

```text
├── api/             # Backend serverless functions (Vercel)
│   ├── get-messages.js
│   └── msg91-webhook.js
├── frontend/        # Frontend static files
│   ├── index.html
│   ├── dashboard.js
│   └── dashboard.css
├── vercel.json      # Routing configuration
└── package.json     # Project dependencies
```

## Setup Instructions

### 1. Supabase Database
Run the following SQL in your Supabase SQL Editor:
```sql
CREATE TABLE wa_reply (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  mobile text,
  message_body text,
  campaign_name text,
  template_name text,
  created_at timestamp WITH TIME ZONE DEFAULT now(),
  date1 text,
  date2 text,
  time text,
  raw_payload jsonb,
  ts text,
  messages jsonb,
  contacts jsonb,
  requestedAt text,
  integratedNumber text,
  contentType text,
  messageType text,
  uuid text,
  status text,
  error_msg text
);
```

### 2. Environment Variables
#### Local Development
Copy the example file and fill in your details:
```bash
cp .env.example .env
```
Open `.env` and add your:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MSG91_WEBHOOK_SECRET`

#### Vercel Production
Add these variables to your Vercel project dashboard under **Settings > Environment Variables**.

### 3. Deployment
Run locally for testing:
```bash
npm run serve
```

Deploy to Vercel:
```bash
vercel
```

## Admin Dashboard
The project includes a premium, glassmorphic admin dashboard located in the `frontend/` directory.

### Features
- **Visual Analytics**: Real-time stats for total replies, today's volume, and unique customers.
- **Advanced Filtering**: Filter by date range, mobile number, or template name.
- **Export Data**: Download your filtered reports as CSV.
- **Secure Access**: Simple secret-key based authentication.

### How to Access
1. Run locally: `npm run serve`
2. Open in your browser: `http://localhost:3000`
3. Enter your `MSG91_WEBHOOK_SECRET` when prompted.

---

## Dashboard Data API

### Get Messages
**Endpoint**: `GET /api/get-messages`

**Headers**:
- `msg91-webhook-secret`: Your secret key

**Query Parameters**:
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `mobile`: Filter by mobile number
- `template_name`: Filter by template name

## Technical Features
- **Clean Separation**: API and Frontend are separated into `api/` and `frontend/` folders.
- **Security**: Validates secret header for both receiving and fetching data.
- **IST Timezone**: Automatically formats all incoming messages to Indian Standard Time.
- **Performance**: Uses Vercel's edge network for lightning-fast dashboard loading.

