# Brevo Email Configuration Guide

## 1. Brevo Account Setup

### Get Your API Key
1. Go to [Brevo](https://www.brevo.com/) and create an account
2. Navigate to **Settings** → **API Keys**
3. Create a new API key with **Send emails** permission
4. Copy the API key (starts with `xkeysib-`)

### Using Brevo's SMTP Email
You're using Brevo's provided SMTP email address: `946dec001@smtp-brevo.com`
- **No verification needed** - this email is already verified by Brevo
- **SMTP Server**: smtp-relay.brevo.com
- **Port**: 587
- **Login**: 946dec001@smtp-brevo.com

## 2. Supabase Environment Variables

Set these environment variables in your Supabase project:

### In Supabase Dashboard:
1. Go to **Settings** → **Edge Functions**
2. Add these environment variables:

```
BREVO_API_KEY=xkeysib-your-api-key-here
SENDER_NAME=DocPilot
APP_URL=https://yourdomain.com
```

### Or via Supabase CLI:
```bash
supabase secrets set BREVO_API_KEY=xkeysib-your-api-key-here
supabase secrets set SENDER_NAME=DocPilot
supabase secrets set APP_URL=https://yourdomain.com
```

**Note**: SENDER_EMAIL is hardcoded to use Brevo's SMTP email `946dec001@smtp-brevo.com` - no need to set this as an environment variable.

## 3. Database Trigger Setup

To automatically trigger emails when invitations are created, you need to set up a database trigger:

### Create the trigger function:
```sql
CREATE OR REPLACE FUNCTION trigger_send_invitation_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Call the Edge Function via HTTP request
  PERFORM
    net.http_post(
      url := 'https://your-project-ref.supabase.co/functions/v1/send-invitation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || 'your-anon-key'
      ),
      body := jsonb_build_object(
        'type', 'INSERT',
        'table', 'workspace_invitations',
        'record', row_to_json(NEW)
      )
    );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Create the trigger:
```sql
CREATE TRIGGER send_invitation_email_trigger
  AFTER INSERT ON workspace_invitations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_send_invitation_email();
```

## 4. Testing

### Test the Edge Function directly:
```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/send-invitation-email' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "INSERT",
    "table": "workspace_invitations",
    "record": {
      "id": "test-id",
      "workspace_id": "workspace-id",
      "inviter_id": "inviter-id",
      "invitee_email": "test@example.com",
      "role": "editor",
      "invitation_token": "test-token",
      "expires_at": "2024-01-01T00:00:00Z",
      "created_at": "2024-01-01T00:00:00Z"
    }
  }'
```

### Test by creating an invitation:
```sql
INSERT INTO workspace_invitations (
  workspace_id, 
  inviter_id, 
  invitee_email, 
  role
) VALUES (
  'your-workspace-id',
  'your-user-id',
  'test@example.com',
  'editor'
);
```

## 5. Troubleshooting

### Common Issues:

1. **"Sender not verified"** - Make sure your sender email is verified in Brevo
2. **"Invalid API key"** - Check that your API key is correct and has email sending permissions
3. **"Function timeout"** - Check Supabase function logs for detailed errors
4. **"Missing environment variables"** - Ensure all required env vars are set

### Check Logs:
```bash
supabase functions logs send-invitation-email
```

## 6. Email Template Customization

The current template includes:
- Responsive HTML design
- Invitation details (inviter, workspace, role)
- Accept invitation button
- Expiration notice
- Plain text fallback

You can customize the email template by modifying the `htmlContent` and `textContent` variables in the Edge Function.

## 7. Rate Limits

Brevo free plan includes:
- 300 emails/day
- 9,000 emails/month

For higher volumes, consider upgrading your Brevo plan.