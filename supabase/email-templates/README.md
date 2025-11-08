# TradeJourno Email Templates

Branded email templates for TradeJourno authentication emails.

## 📋 Quick Setup Guide

### Step 1: Upload Logo to Supabase Storage

**Option A: Automated (Recommended)**

```bash
# Make sure you have your SUPABASE_SERVICE_ROLE_KEY in .env.local
node scripts/upload-email-logo.js
```

The script will:
- Create a `public-assets` bucket (if needed)
- Upload the logo to `email-assets/logo.png`
- Output the public URL to use in templates

**Option B: Manual Upload**

1. Go to Supabase Dashboard → Storage
2. Create a new **public** bucket named `public-assets`
3. Upload `public/android-chrome-192x192.png` to path `email-assets/logo.png`
4. Copy the public URL (format: `https://[PROJECT-ID].supabase.co/storage/v1/object/public/public-assets/email-assets/logo.png`)

### Step 2: Update Email Templates

1. **Go to Supabase Dashboard**
   - Navigate to: Authentication → Email Templates

2. **Confirm Signup Template**
   - Select "Confirm signup" from dropdown
   - Copy content from [`confirm-signup.html`](./confirm-signup.html)
   - Replace `[YOUR-PROJECT-ID]` with your actual Supabase project ID
   - Update the **Subject line**: `Welcome to TradeJourno - Confirm Your Email`
   - Click "Save"

3. **Reset Password Template**
   - Select "Reset Password" from dropdown
   - Copy content from [`reset-password.html`](./reset-password.html)
   - Replace `[YOUR-PROJECT-ID]` with your actual Supabase project ID
   - Update the **Subject line**: `Reset Your TradeJourno Password`
   - Click "Save"

### Step 3: Test Your Templates

**Test Signup Confirmation:**
```bash
# Create a test account with a real email you control
# Check your inbox for the confirmation email
```

**Test Password Reset:**
```bash
# Click "Forgot password?" in the login dialog
# Enter your email
# Check your inbox for the reset email
```

## 📧 Available Templates

### 1. Confirm Signup (`confirm-signup.html`)
- **Subject**: Welcome to TradeJourno - Confirm Your Email
- **Purpose**: Sent when user creates an account with email/password
- **Features**:
  - TradeJourno logo
  - Branded gradient header
  - Clear call-to-action button
  - Alternative confirmation link
  - Professional footer

### 2. Reset Password (`reset-password.html`)
- **Subject**: Reset Your TradeJourno Password
- **Purpose**: Sent when user requests password reset
- **Features**:
  - TradeJourno logo
  - Security notice (60-minute expiry)
  - Clear call-to-action button
  - Alternative reset link
  - Professional footer

### 3. Invite User (`invite-user.html`)
- **Subject**: You're Invited to Join TradeJourno!
- **Purpose**: Sent programmatically when admin invites new users
- **Features**:
  - TradeJourno logo
  - Prominent invite code display
  - Feature highlights (Trading Journal, Performance Analytics, Economic Calendar, AI Assistant, Risk Management)
  - Dynamic expiry notice based on uses and expiration
  - Call-to-action button with invite code in URL
  - Professional footer
- **Note**: This template is used by the `send-invite-email` Edge Function, not configured in Supabase Dashboard

## 🎨 Customization

### Changing Colors

The templates use TradeJourno's brand colors:
- **Primary Blue**: `#1976d2`
- **Secondary Purple**: `#9c27b0`
- **Background**: `#f5f5f5`
- **Text**: `#333333` (headings), `#666666` (body)

To customize, find and replace these hex codes in the templates.

### Logo Styling

Current logo styling:
```html
<img
  src="..."
  style="width: 80px; height: 80px; border-radius: 20px; margin: 0 auto 20px; display: block; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);"
/>
```

Adjust `width`, `height`, and `border-radius` to fit your needs.

## 🚀 Sending Invite Emails Programmatically

The `send-invite-email` Edge Function allows you to send branded invite emails to users.

**Prerequisites:**
1. Set the `RESEND_API_KEY` environment variable in Supabase:
   ```bash
   npx supabase secrets set RESEND_API_KEY=your_resend_api_key_here
   ```

**Usage Example:**
```typescript
const response = await fetch(
  'https://gwubzauelilziaqnsfac.supabase.co/functions/v1/send-invite-email',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'user@example.com',
      inviteCode: 'ABC123',
      expiresAt: '2025-12-31T23:59:59Z', // Optional
      maxUses: 1 // Optional, defaults to 1
    })
  }
);

const data = await response.json();
console.log('Email sent:', data.emailId);
```

**Request Parameters:**
- `email` (required): Email address to send invite to
- `inviteCode` (required): The invite code to include in email
- `expiresAt` (optional): ISO date string for expiration
- `maxUses` (optional): Maximum uses for this invite

**Response:**
```json
{
  "success": true,
  "message": "Invite email sent successfully",
  "emailId": "resend-email-id"
}
```

## 🔧 Troubleshooting

### Logo Not Showing

**Problem**: Email shows broken image icon

**Solutions**:
1. Verify bucket is **public** (not private)
2. Check the image URL is accessible in browser
3. Ensure URL format: `https://[PROJECT-ID].supabase.co/storage/v1/object/public/public-assets/email-assets/logo.png`
4. Some email clients block images by default - ask user to "Load images"

### Template Not Updating

**Problem**: Changes don't appear in test emails

**Solutions**:
1. Clear browser cache and refresh Supabase dashboard
2. Wait 1-2 minutes for changes to propagate
3. Try sending to a different email address

### Confirmation Email Not Arriving

**Problem**: User doesn't receive confirmation email

**Solutions**:
1. Check spam/junk folder
2. Verify email address is correct
3. Check Supabase logs: Dashboard → Logs → Auth logs
4. Ensure email confirmation is enabled: Dashboard → Authentication → Settings → Enable email confirmations

## 📝 Notes

- Template variables like `{{ .ConfirmationURL }}` are replaced by Supabase automatically
- Templates are responsive and work on mobile devices
- Tested on Gmail, Outlook, Apple Mail, and Yahoo Mail
- Uses inline CSS for maximum email client compatibility

## 🔗 Useful Links

- [Supabase Email Templates Docs](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Email Template Variables](https://supabase.com/docs/reference/cli/config#auth.email)
- [TradeJourno Documentation](../README.md)
