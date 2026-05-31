import React from 'react';
import { Typography, Link } from '@mui/material';

const RefundContent: React.FC = () => (
  <>
    <Typography variant="body1">
      This Refund Policy explains when refunds are available on JournoTrades paid plans and how to
      request one. It applies to all paid subscriptions sold through Paddle, our Merchant of
      Record.
    </Typography>

    <Typography variant="h3" component="h2">1. 14-day refund window</Typography>
    <Typography variant="body1">
      If you subscribe to a paid JournoTrades plan and decide it is not for you, you can request a
      full refund within 14 days of your initial purchase. This applies equally to monthly and
      annual plans. No questions asked.
    </Typography>

    <Typography variant="h3" component="h2">2. How to request a refund</Typography>
    <Typography variant="body1">
      Email <Link href="mailto:support@journotrades.com">support@journotrades.com</Link> from the
      address on your account, or contact us in-app. Include your account email and, if you have
      it handy, your Paddle order or transaction ID. We process approved refunds within 5 to 10
      business days through Paddle to your original payment method. The time it takes to land back
      in your account depends on your card issuer or bank.
    </Typography>

    <Typography variant="h3" component="h2">3. After the 14-day window</Typography>
    <Typography variant="body1">
      Subscriptions are non-refundable after the 14-day window. You can cancel at any time from
      in-app settings: you will retain access to your paid plan until the end of the current
      billing period, and then your account will drop to the free plan. We do not issue pro-rata
      refunds for unused time on a billing period.
    </Typography>

    <Typography variant="h3" component="h2">4. Upgrades and downgrades</Typography>
    <Typography variant="body1">
      Upgrading mid-cycle (for example, moving from a lower tier to a higher tier) charges the
      pro-rata difference through Paddle and takes effect immediately. Downgrading takes effect at
      the next renewal: you keep your current tier until then, and no refund is issued for the
      remainder of the current period.
    </Typography>

    <Typography variant="h3" component="h2">5. Failed payments</Typography>
    <Typography variant="body1">
      If a renewal payment fails, Paddle will retry on its standard dunning schedule and notify
      you by email. If retries continue to fail, your account drops to the free plan at the end of
      the current billing period. No fee or penalty applies.
    </Typography>

    <Typography variant="h3" component="h2">6. Chargebacks</Typography>
    <Typography variant="body1">
      Opening a payment chargeback without first contacting{' '}
      <Link href="mailto:support@journotrades.com">support@journotrades.com</Link> will result in
      your account being suspended while we resolve the dispute. In almost every case we would
      rather refund you directly than fight a chargeback, so please reach out first.
    </Typography>

    <Typography variant="h3" component="h2">7. Contact</Typography>
    <Typography variant="body1">
      Refund questions or requests? Email{' '}
      <Link href="mailto:support@journotrades.com">support@journotrades.com</Link>.
    </Typography>
  </>
);

export default RefundContent;
