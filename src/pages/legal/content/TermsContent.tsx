import React from 'react';
import { Typography, Link } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const TermsContent: React.FC = () => (
  <>
    <Typography variant="body1">
      Welcome to JournoTrades. These Terms of Service ("Terms") govern your access to and use of
      JournoTrades (the "Service"). By creating an account or using the Service, you agree to these
      Terms. If you do not agree, do not use the Service.
    </Typography>

    <Typography variant="h3" component="h2">1. What JournoTrades is</Typography>
    <Typography variant="body1">
      JournoTrades is a trading journal with an AI assistant ("Orion") that helps you log trades,
      analyze your performance, track economic events, and write notes. The Service is operated
      from the Federal Republic of Nigeria by JournoTrades, a business registered in Nigeria.
      JournoTrades is not a broker, exchange, custodian, investment adviser, or regulated financial
      institution. Nothing on JournoTrades is an offer to buy or sell any security, currency, or
      asset.
    </Typography>

    <Typography variant="h3" component="h2">2. Accounts</Typography>
    <Typography variant="body1">
      You must be at least 16 years old to use JournoTrades. You are responsible for keeping your
      credentials secure and for all activity that occurs under your account. One account per
      person. Notify us at <Link href="mailto:support@journotrades.com">support@journotrades.com</Link>
      {' '}if you believe your account has been accessed without your permission.
    </Typography>

    <Typography variant="h3" component="h2">3. Acceptable use</Typography>
    <Typography variant="body1">You agree not to:</Typography>
    <ul>
      <li><Typography variant="body1" component="span">Scrape, crawl, or extract data from JournoTrades by automated means.</Typography></li>
      <li><Typography variant="body1" component="span">Reverse-engineer, decompile, or attempt to derive source code from the Service.</Typography></li>
      <li><Typography variant="body1" component="span">Use Orion to generate content for resale, redistribution, or to power another product.</Typography></li>
      <li><Typography variant="body1" component="span">Upload content you do not have the right to upload, or content that is unlawful, defamatory, or infringing.</Typography></li>
      <li><Typography variant="body1" component="span">Interfere with the operation of the Service, probe its security, or abuse rate limits.</Typography></li>
    </ul>

    <Typography variant="h3" component="h2">4. Your content</Typography>
    <Typography variant="body1">
      Your trades, notes, tags, uploaded images, and Orion conversations remain yours. By using the
      Service you grant JournoTrades a worldwide, non-exclusive, royalty-free license to host,
      store, process, transmit, and display your content for the sole purpose of operating and
      improving the Service for you. We do not claim ownership of your content and we do not use it
      to train AI models.
    </Typography>

    <Typography variant="h3" component="h2">5. Orion AI output is not advice</Typography>
    <Typography variant="body1">
      Orion produces AI-generated responses that can be incomplete, outdated, or wrong. Nothing
      Orion says is financial, investment, tax, accounting, or legal advice. Do not act on Orion's
      output without independent verification. Trading is risky and you can lose money. You are
      solely responsible for your trading decisions.
    </Typography>

    <Typography variant="h3" component="h2">6. Subscriptions and billing</Typography>
    <Typography variant="body1">
      Paid plans are sold by Paddle.com Market Ltd ("Paddle"), our Merchant of Record. Paddle
      handles billing, taxes, and payment processing. Plans, prices, and billing cycles are
      described on our <Link component={RouterLink} to="/pricing">pricing page</Link>. Subscriptions
      auto-renew at the end of each billing cycle until you cancel. Cancellations take effect at the
      end of the current cycle; you retain access through that date. Refunds are governed by our{' '}
      <Link component={RouterLink} to="/refunds">refund policy</Link>.
    </Typography>

    <Typography variant="h3" component="h2">7. Service availability</Typography>
    <Typography variant="body1">
      We aim to keep the Service available but do not guarantee uninterrupted access. We may
      modify, suspend, or discontinue any part of the Service at any time. Planned maintenance and
      unplanned outages will happen.
    </Typography>

    <Typography variant="h3" component="h2">8. Third-party services</Typography>
    <Typography variant="body1">
      Orion connects to external providers for price data, economic events, web search, and chart
      rendering. The accuracy, availability, and content of those providers is outside our
      control. Their failure or inaccuracy is not a breach of these Terms.
    </Typography>

    <Typography variant="h3" component="h2">9. Termination</Typography>
    <Typography variant="body1">
      You may delete your account at any time from in-app settings. We may suspend or terminate
      your account if you violate these Terms, abuse the Service, or initiate a payment chargeback
      without first contacting support. On termination, your right to use the Service ends
      immediately; data retention is governed by our{' '}
      <Link component={RouterLink} to="/privacy">privacy policy</Link>.
    </Typography>

    <Typography variant="h3" component="h2">10. Disclaimers</Typography>
    <Typography variant="body1">
      The Service is provided "as is" and "as available" without warranties of any kind, express or
      implied, including warranties of merchantability, fitness for a particular purpose,
      non-infringement, accuracy, or that the Service will be uninterrupted or error-free.
    </Typography>

    <Typography variant="h3" component="h2">11. Limitation of liability</Typography>
    <Typography variant="body1">
      To the maximum extent permitted by law, JournoTrades is not liable for any indirect,
      incidental, special, consequential, or punitive damages, or for any loss of profits, revenue,
      data, or trading losses, arising out of or related to your use of the Service. Our aggregate
      liability for any claim arising out of these Terms or the Service is limited to the amount
      you paid us in the twelve months immediately before the event giving rise to the claim, or
      USD 50, whichever is greater. Nothing in these Terms limits liability that cannot lawfully be
      limited (including liability for death, personal injury caused by negligence, or fraud).
    </Typography>

    <Typography variant="h3" component="h2">12. Changes to these Terms</Typography>
    <Typography variant="body1">
      We may update these Terms from time to time. Material changes will be announced in-app or by
      email at least 14 days before they take effect. Continued use of the Service after the
      effective date constitutes acceptance of the updated Terms.
    </Typography>

    <Typography variant="h3" component="h2">13. Governing law</Typography>
    <Typography variant="body1">
      These Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute arising
      out of or relating to these Terms or the Service is subject to the exclusive jurisdiction of
      the courts of Lagos State, Nigeria. If you live in the European Union, the United Kingdom, or
      another region whose consumer protection laws give you mandatory rights that cannot be waived
      by contract, those rights are not affected by this section.
    </Typography>

    <Typography variant="h3" component="h2">14. Contact</Typography>
    <Typography variant="body1">
      Questions about these Terms? Email{' '}
      <Link href="mailto:support@journotrades.com">support@journotrades.com</Link>.
    </Typography>
  </>
);

export default TermsContent;
