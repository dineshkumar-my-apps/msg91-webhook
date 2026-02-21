# MSG91 Webhook Backend (Vercel + Supabase)

This is a production-ready webhook backend for MSG91 WhatsApp/SMS notifications using Vercel Serverless Functions and Supabase.

## Setup Instructions

### 1. Supabase Database
Run the following SQL in your Supabase SQL Editor:
```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  message_id text,
  mobile text,
  template_name text,
  direction text,
  status text,
  message_type text,
  message_body text,
  raw_payload jsonb,
  created_at timestamp default now()
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

## How to Test with Postman

1. **Setting**:
   - Method: `POST`
   - URL: `https://your-vercel-domain.vercel.app/api/msg91-webhook`
   - Headers:
     - `Content-Type`: `application/json`
     - `x-msg91-signature`: (Generate HMAC SHA256 of the body using your secret if validation is enabled)

2. **Body (JSON)**:
```json
{
  "messageId": "msg_123456789",
  "mobile": "919999999999",
  "templateName": "welcome_message",
  "direction": "outgoing",
  "status": "delivered",
  "type": "text",
  "text": "Hello! Your verification code is 1234.",
  "timestamp": "2024-02-21T12:00:00Z"
}
```

## Dashboard Data API

### Get Messages
**Endpoint**: `GET /api/get-messages`

**Headers**:
- `msg91-webhook-secret`: Your secret key

**Query Parameters**:
- `start_date`: YYYY-MM-DD (matches `date1`)
- `end_date`: YYYY-MM-DD (matches `date1`)
- `mobile`: Filter by mobile number
- `template_name`: Filter by template

**Example**:
`GET /api/get-messages?start_date=2024-02-01&end_date=2024-02-21`

## Features
- **Security**: Validates secret header for both receiving and fetching data.
- **Resilience**: Proper error handling with try/catch and HTTP status codes.
- **Kolkata Timezone**: Automatically formats all incoming messages to IST.
- **Dashboard Ready**: Clean JSON output for your admin dashboard.
