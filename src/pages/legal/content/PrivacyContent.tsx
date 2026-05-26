import React from 'react';
import { Typography, Link } from '@mui/material';

const PrivacyContent: React.FC = () => (
  <>
    <Typography variant="body1">
      This Privacy Policy explains what data JournoTrades collects, how we use it, who we share it
      with, and the rights you have over it. We aim to describe our practices in plain English, not
      legalese.
    </Typography>

    <Typography variant="h3">1. What we collect</Typography>
    <Typography variant="body1">
      To run the Service, we collect:
    </Typography>
    <ul>
      <li><Typography variant="body1" component="span"><strong>Account data</strong> — your email address and either a hashed password (via Supabase Auth) or an OAuth identifier from your sign-in provider.</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Product data</strong> — calendars, trades, notes, tags, uploaded trade images, Orion conversations, and AI memory entries you create.</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Billing data</strong> — a Paddle customer ID and your current subscription state. We do not store payment card numbers; Paddle handles all card data.</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Operational data</strong> — server logs (IP address, user agent, edge function invocations) and error reports needed to keep the Service running and to debug issues.</Typography></li>
    </ul>

    <Typography variant="h3">2. What we do not collect</Typography>
    <Typography variant="body1">
      We do not embed advertising trackers, third-party analytics that profile you across the web,
      session replay tools, or fingerprinting libraries. We do not sell your data.
    </Typography>

    <Typography variant="h3">3. How we use your data</Typography>
    <Typography variant="body1">
      We use the data above to:
    </Typography>
    <ul>
      <li><Typography variant="body1" component="span">Provide the Service and render your data back to you.</Typography></li>
      <li><Typography variant="body1" component="span">Run Orion (send your conversation, retrieved context, and the trade data Orion is asked about to Google's Gemini API at inference time).</Typography></li>
      <li><Typography variant="body1" component="span">Send transactional email (sign-in links, reminders, billing receipts, account notifications).</Typography></li>
      <li><Typography variant="body1" component="span">Debug errors, prevent abuse, and enforce these Terms.</Typography></li>
      <li><Typography variant="body1" component="span">Comply with legal obligations (e.g. tax records).</Typography></li>
    </ul>

    <Typography variant="h3">4. AI training</Typography>
    <Typography variant="body1">
      <strong>We do not train AI models on your data.</strong> Your conversations and trade content
      are sent to Google's Gemini API only at inference time, to generate responses to your
      requests. Under Google's paid API terms, that traffic is not used to train Google's models.
      We do not fine-tune any model on individual user data.
    </Typography>

    <Typography variant="h3">5. Sub-processors</Typography>
    <Typography variant="body1">
      We use the following services to operate JournoTrades. They process data only on our behalf
      and only as needed to deliver the Service:
    </Typography>
    <ul>
      <li><Typography variant="body1" component="span"><strong>Supabase</strong> — Postgres database, file storage, authentication, edge functions, realtime. Data is hosted in the European Union (AWS Europe region).</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Google (Gemini API)</strong> — generates Orion's responses and produces semantic embeddings. Receives the content of your Orion requests at inference time.</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Paddle</strong> — Merchant of Record for subscriptions. Holds payment data, calculates tax, and sends billing receipts.</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Resend</strong> — sends transactional email (invites, reminders, account notifications).</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Serper</strong> and <strong>Tavily</strong> — web search providers used by Orion. Receive search queries derived from your requests, not raw conversation history.</Typography></li>
      <li><Typography variant="body1" component="span"><strong>Twelve Data</strong> and <strong>Yahoo Finance</strong> — price and historical-candle feeds. Receive ticker symbols only; no user identity.</Typography></li>
      <li><Typography variant="body1" component="span"><strong>QuickChart</strong> — renders chart images requested by Orion. Receives chart data structures, which may include values derived from your trades when you ask Orion to chart your performance.</Typography></li>
    </ul>
    <Typography variant="body1">
      Adding a new sub-processor or materially changing how one is used will be reflected in this
      list. We will announce material changes in-app or by email before they take effect.
    </Typography>

    <Typography variant="h3">6. Cookies and local storage</Typography>
    <Typography variant="body1">
      We do not use third-party advertising cookies. The Service uses:
    </Typography>
    <ul>
      <li><Typography variant="body1" component="span">A Supabase Auth session token to keep you signed in.</Typography></li>
      <li><Typography variant="body1" component="span">Browser <code>localStorage</code> for your theme preference, draft notes, and Orion UI state.</Typography></li>
    </ul>
    <Typography variant="body1">
      Clearing your browser storage signs you out and discards local preferences but does not
      affect data stored on our servers.
    </Typography>

    <Typography variant="h3">7. Data retention</Typography>
    <Typography variant="body1">
      Your data persists for the life of your account. When you delete your account, we
      permanently remove your calendars, trades, notes, Orion conversations, AI memory, and
      uploaded images within 30 days. Backups roll off within 90 days. Billing records are retained
      for the periods required by applicable tax and accounting law.
    </Typography>

    <Typography variant="h3">8. Your rights</Typography>
    <Typography variant="body1">
      Subject to applicable law (including the UK GDPR, EU GDPR, and CCPA), you have the right to:
    </Typography>
    <ul>
      <li><Typography variant="body1" component="span">Access a copy of the data we hold about you.</Typography></li>
      <li><Typography variant="body1" component="span">Export your trade data at any time from in-app settings.</Typography></li>
      <li><Typography variant="body1" component="span">Correct inaccurate or incomplete data.</Typography></li>
      <li><Typography variant="body1" component="span">Delete your account and the data tied to it.</Typography></li>
      <li><Typography variant="body1" component="span">Object to or restrict certain processing, or withdraw consent where processing relies on consent.</Typography></li>
      <li><Typography variant="body1" component="span">Lodge a complaint with your local data protection authority (e.g. the UK ICO).</Typography></li>
    </ul>
    <Typography variant="body1">
      To exercise any of these rights, email{' '}
      <Link href="mailto:support@journotrades.com">support@journotrades.com</Link> from the address
      on your account. We will respond within 30 days.
    </Typography>

    <Typography variant="h3">9. International transfers</Typography>
    <Typography variant="body1">
      Some of our sub-processors operate globally. Where data is transferred outside the country
      you live in, the transfer relies on the safeguards required by applicable law (such as the
      UK International Data Transfer Agreement or EU Standard Contractual Clauses).
    </Typography>

    <Typography variant="h3">10. Security</Typography>
    <Typography variant="body1">
      We use TLS for data in transit, encryption at rest (managed by Supabase), and PostgreSQL Row
      Level Security on all user-scoped tables so users can only read their own data. API keys for
      sub-processors are scoped and rotated. No system is perfectly secure; we will notify affected
      users and authorities of any data breach as required by law.
    </Typography>

    <Typography variant="h3">11. Children</Typography>
    <Typography variant="body1">
      JournoTrades is not directed at children under 16, and we do not knowingly collect personal
      data from anyone under 16. If you believe a child has provided us with personal data, contact
      us and we will delete it.
    </Typography>

    <Typography variant="h3">12. Changes to this policy</Typography>
    <Typography variant="body1">
      We may update this Privacy Policy from time to time. Material changes will be announced
      in-app or by email at least 14 days before they take effect. The "Last updated" date at the
      top of this page reflects the most recent revision.
    </Typography>

    <Typography variant="h3">13. Contact</Typography>
    <Typography variant="body1">
      Privacy questions or requests? Email{' '}
      <Link href="mailto:support@journotrades.com">support@journotrades.com</Link>.
    </Typography>
  </>
);

export default PrivacyContent;
