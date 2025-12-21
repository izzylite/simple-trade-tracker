# Auth Configuration Changes Required

This document outlines the authentication configuration changes that need to be made via the Supabase Dashboard to resolve security advisor warnings.

## Issues Identified

The following auth configuration issues were detected by the Supabase security advisor:

### 1. OTP Expiry Too Long (WARN)
**Issue:** OTP (One-Time Password) expiry is set to more than 1 hour
**Risk Level:** Medium
**Remediation Link:** https://supabase.com/docs/guides/platform/going-into-prod#security

**Current Status:** OTP expiry > 1 hour
**Recommended Value:** ≤ 1 hour (3600 seconds)

**Impact:**
- Longer OTP expiry increases the window for potential brute-force attacks
- Users who obtain an OTP can use it for an extended period
- Not compliant with security best practices for going into production

### 2. Leaked Password Protection Disabled (WARN)
**Issue:** Password leak detection against HaveIBeenPwned database is disabled
**Risk Level:** Medium
**Remediation Link:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

**Current Status:** Disabled
**Recommended Value:** Enabled

**Impact:**
- Users can set passwords that have been compromised in known data breaches
- Increases risk of account takeover via credential stuffing attacks
- Does not meet modern security standards for password protection

---

## How to Fix via Supabase Dashboard

### Fix 1: Reduce OTP Expiry

1. **Navigate to Auth Settings**
   - Go to your Supabase project dashboard
   - Click on **Authentication** in the left sidebar
   - Select **Settings** from the Auth submenu

2. **Update OTP Expiry**
   - Scroll to **Email Provider Settings** section
   - Look for **OTP Expiry** or **Magic Link Expiry** setting
   - Change the value to **3600** seconds (1 hour) or less
   - Recommended: **1800** seconds (30 minutes) for better security

3. **Save Changes**
   - Click **Save** to apply the changes

**Alternative via SQL (if configuration table exists):**
```sql
-- This may not work depending on Supabase version
-- Prefer using the dashboard method
UPDATE auth.config
SET otp_expiry = 3600
WHERE key = 'email_provider';
```

### Fix 2: Enable Leaked Password Protection

1. **Navigate to Auth Settings**
   - Go to your Supabase project dashboard
   - Click on **Authentication** in the left sidebar
   - Select **Settings** from the Auth submenu

2. **Enable Password Protection**
   - Scroll to **Password Settings** or **Security** section
   - Look for **Leaked Password Protection** or **Password Breach Detection**
   - Toggle the switch to **Enabled** / **ON**
   - This will enable checking against the HaveIBeenPwned database

3. **Configure Additional Password Policies (Recommended)**
   While you're in the password settings, also consider:
   - **Minimum Password Length:** 8-12 characters
   - **Password Complexity:** Require mix of letters, numbers, symbols
   - **Password History:** Prevent reuse of recent passwords

4. **Save Changes**
   - Click **Save** to apply the changes

**What Happens When Enabled:**
- During signup, Supabase will check new passwords against the HaveIBeenPwned API
- If a password has been leaked, the user will be required to choose a different password
- This check happens server-side and does not expose the actual password
- Uses k-anonymity model (only first 5 characters of SHA-1 hash are sent)

---

## Verification

After making these changes, you can verify they've been applied:

### 1. Verify OTP Expiry
- Test the magic link / OTP email flow
- Check the timestamp in the email and ensure it expires within 1 hour
- Or check the auth logs for OTP expiry duration

### 2. Verify Leaked Password Protection
- Try to sign up with a known leaked password (e.g., "Password123!")
- The system should reject it and prompt for a different password
- Check the error message returned from the signup API

### 3. Re-run Supabase Advisor
After making changes, run the advisor again to confirm the warnings are resolved:

```bash
# If using Supabase CLI
npx supabase inspect db --linked --checks security

# Or check via Dashboard
# Go to Database > Advisor > Security tab
```

---

## Impact Assessment

### Users Affected
- **OTP Expiry Change:**
  - Affects users who use email-based magic link authentication
  - Minimal impact if users typically click links quickly
  - May inconvenience users who wait >1 hour to use their link

- **Leaked Password Protection:**
  - Affects new user signups and password changes
  - Prevents use of compromised passwords
  - May require some users to choose stronger passwords

### Recommendations
1. **Make these changes during low-traffic hours** to minimize user disruption
2. **Update user documentation** if you have any, mentioning password requirements
3. **Consider notifying existing users** about security improvements (optional)
4. **Test thoroughly** in a development/staging environment first

---

## Additional Security Enhancements (Optional)

While you're updating auth configuration, consider these additional security measures:

### Multi-Factor Authentication (MFA)
- Enable MFA/2FA support for user accounts
- Provides additional layer of security beyond passwords

### Session Management
- Review session timeout settings
- Consider implementing automatic session refresh
- Set appropriate JWT expiry times

### Rate Limiting
- Enable rate limiting on auth endpoints
- Helps prevent brute-force attacks
- Configure appropriate limits for signup, login, password reset

### Email Templates
- Customize email templates for better user experience
- Add security notices and tips to auth emails
- Include links to security best practices

---

## References

- [Supabase Auth Configuration](https://supabase.com/docs/guides/auth/auth-config)
- [Going to Production Security Checklist](https://supabase.com/docs/guides/platform/going-into-prod#security)
- [Password Security Best Practices](https://supabase.com/docs/guides/auth/password-security)
- [HaveIBeenPwned API](https://haveibeenpwned.com/API/v3)

---

## Completion Checklist

- [ ] OTP expiry reduced to ≤ 1 hour (3600 seconds)
- [ ] Leaked password protection enabled
- [ ] Changes tested in development/staging
- [ ] Changes verified via Supabase Advisor
- [ ] User documentation updated (if applicable)
- [ ] Team notified of changes
- [ ] Changes deployed to production

---

**Last Updated:** 2025-12-21
**Migration Reference:** Part of Supabase advisor fixes (migrations 052-056)
