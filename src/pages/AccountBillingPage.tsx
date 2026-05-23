import React, { useEffect, useState } from 'react';
import {
  Box, Container, Typography, Button, Chip, Stack, CircularProgress, Alert,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CardShell from 'components/common/CardShell';
import { supabase } from 'config/supabase';
import { useAuth } from 'contexts/SupabaseAuthContext';

interface SubRow {
  tier: 'free' | 'lite' | 'pro' | 'elite';
  status: string;
  billing_cycle: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

const AccountBillingPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const justPurchased = searchParams.get('status') === 'success';

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('tier, status, billing_cycle, current_period_end, cancel_at_period_end')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) {
        setSub(data as SubRow | null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, navigate]);

  const handleManage = async () => {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke('paddle-portal-session');
      if (error || !data?.url) {
        alert('Could not open billing portal. Please try again.');
        return;
      }
      window.open(data.url, '_blank', 'noopener');
    } finally {
      setOpening(false);
    }
  };

  if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

  const tierLabel = sub?.tier === 'free' ? 'Free'
    : sub?.tier === 'lite' ? 'Lite'
    : sub?.tier === 'pro' ? 'Pro'
    : sub?.tier === 'elite' ? 'Elite'
    : 'Free';

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>Billing</Typography>

      {justPurchased && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Thanks for subscribing. Your plan may take a few seconds to activate.
        </Alert>
      )}

      <CardShell sx={{ p: 4 }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500 }}>{tierLabel}</Typography>
          {sub?.status && sub.status !== 'active' && (
            <Chip label={sub.status} size="small" color={sub.status === 'past_due' ? 'warning' : 'default'} />
          )}
        </Stack>

        {sub?.billing_cycle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Billed {sub.billing_cycle}
          </Typography>
        )}
        {sub?.current_period_end && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            {sub.cancel_at_period_end ? 'Access ends ' : 'Renews '}
            {new Date(sub.current_period_end).toLocaleDateString()}
          </Typography>
        )}

        <Stack direction="row" spacing={2}>
          {(!sub || sub.tier === 'free') ? (
            <Button variant="contained" onClick={() => navigate('/pricing')}>
              See plans
            </Button>
          ) : (
            <Button variant="outlined" onClick={handleManage} disabled={opening}>
              {opening ? 'Opening…' : 'Manage subscription'}
            </Button>
          )}
        </Stack>
      </CardShell>
    </Container>
  );
};

export default AccountBillingPage;
