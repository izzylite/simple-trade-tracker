import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  Toolbar,
  Container
} from '@mui/material';
import {
  Restore as RestoreIcon,
  DeleteForever as DeleteForeverIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarIcon,
  ArrowBack as ArrowBackIcon,
  Warning as WarningIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material/styles';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import {
  getTrashCalendars,
  restoreCalendarFromTrash,
  permanentlyDeleteCalendar,
  getDaysUntilDeletion,
  TrashCalendar
} from '../../services/trashService';
import Shimmer from '../Shimmer';
import AppHeader from '../common/AppHeader';

const TrashCalendarSkeleton = () => {
  const theme = useTheme();

  return (
    <Card
      sx={{
        height: '100%',
        borderRadius: 3,
        border: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.2s ease-in-out',
        position: 'relative',
        overflow: 'visible'
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Stack spacing={3}>
          {/* Header */}
          <Box>
            <Box display="flex" alignItems="center" gap={1.5} mb={1}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Shimmer
                  height={24}
                  width={24}
                  borderRadius="50%"
                  variant="pulse"
                  intensity="medium"
                />
              </Box>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Shimmer
                  height={24}
                  width="70%"
                  borderRadius={6}
                  variant="wave"
                  intensity="high"
                  sx={{ mb: 1 }}
                />
                <Shimmer
                  height={16}
                  width="50%"
                  borderRadius={4}
                  variant="default"
                  intensity="low"
                />
              </Box>
            </Box>
          </Box>

          {/* Countdown */}
          <Box
            sx={{
              backgroundColor: alpha(theme.palette.warning.main, 0.1),
              borderRadius: 2,
              p: 2,
              textAlign: 'center'
            }}
          >
            <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
              <Shimmer
                height={20}
                width={20}
                borderRadius="50%"
                variant="pulse"
                intensity="medium"
              />
              <Shimmer
                height={32}
                width={40}
                borderRadius={8}
                variant="wave"
                intensity="high"
              />
              <Shimmer
                height={16}
                width={60}
                borderRadius={4}
                variant="default"
                intensity="low"
              />
            </Box>
            <Shimmer
              height={14}
              width="80%"
              borderRadius={4}
              variant="default"
              intensity="low"
              sx={{ mx: 'auto' }}
            />
          </Box>

          {/* Stats */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              pt: 1
            }}
          >
            <Box sx={{ textAlign: 'center' }}>
              <Shimmer
                height={24}
                width="80%"
                borderRadius={6}
                variant="wave"
                intensity="medium"
                sx={{ mb: 1, mx: 'auto' }}
              />
              <Shimmer
                height={14}
                width="60%"
                borderRadius={4}
                variant="default"
                intensity="low"
                sx={{ mx: 'auto' }}
              />
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Shimmer
                height={24}
                width="60%"
                borderRadius={6}
                variant="wave"
                intensity="medium"
                sx={{ mb: 1, mx: 'auto' }}
              />
              <Shimmer
                height={14}
                width="50%"
                borderRadius={4}
                variant="default"
                intensity="low"
                sx={{ mx: 'auto' }}
              />
            </Box>
          </Box>
        </Stack>
      </CardContent>

      <CardActions sx={{ p: 3, pt: 0, gap: 1 }}>
        <Shimmer
          height={40}
          width="100%"
          borderRadius={8}
          variant="pulse"
          intensity="medium"
        />
        <Shimmer
          height={40}
          width="100%"
          borderRadius={8}
          variant="default"
          intensity="low"
        />
      </CardActions>
    </Card>
  );
};

interface CalendarTrashProps {
  onToggleTheme: () => void;
  mode: 'light' | 'dark';
}

const CalendarTrash: React.FC<CalendarTrashProps> = ({ onToggleTheme, mode }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [trashCalendars, setTrashCalendars] = useState<TrashCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'restore' | 'delete';
    calendar: TrashCalendar | null;
  }>({
    open: false,
    action: 'restore',
    calendar: null
  });

  useEffect(() => {
    loadTrashCalendars();
  }, [user]);

  const loadTrashCalendars = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const calendars = await getTrashCalendars(user.uid);
      setTrashCalendars(calendars);
    } catch (error) {
      console.error('Error loading trash calendars:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (calendar: TrashCalendar) => {
    try {
      setActionLoading(calendar.id);
      await restoreCalendarFromTrash(calendar.id);
      await loadTrashCalendars(); // Refresh the list
      setConfirmDialog({ open: false, action: 'restore', calendar: null });
    } catch (error) {
      console.error('Error restoring calendar:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handlePermanentDelete = async (calendar: TrashCalendar) => {
    try {
      setActionLoading(calendar.id);
      await permanentlyDeleteCalendar(calendar.id);
      await loadTrashCalendars(); // Refresh the list
      setConfirmDialog({ open: false, action: 'delete', calendar: null });
    } catch (error) {
      console.error('Error permanently deleting calendar:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const openConfirmDialog = (action: 'restore' | 'delete', calendar: TrashCalendar) => {
    setConfirmDialog({ open: true, action, calendar });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, action: 'restore', calendar: null });
  };

  const getDeletionStatusColor = (daysLeft: number) => {
    if (daysLeft <= 3) return theme.palette.error.main;
    if (daysLeft <= 7) return theme.palette.warning.main;
    return theme.palette.info.main;
  };



  if (loading) {
    return (
      <>
        <AppHeader
          onToggleTheme={onToggleTheme}
          mode={mode}
        />
        <Toolbar />

        <Container maxWidth="lg" sx={{ mt: 4, pb: 4 }}>
          {/* Loading skeletons */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)'
              },
              gap: 3
            }}
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <TrashCalendarSkeleton key={index} />
            ))}
          </Box>
        </Container>
      </>
    );
  }

  return (
    <>
      <AppHeader
        onToggleTheme={onToggleTheme}
        mode={mode}
      />
      <Toolbar />

      <Container maxWidth="lg" sx={{ mt: 4, pb: 4 }}>
      {trashCalendars.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center'
          }}
        >
          <Box
            sx={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: alpha(theme.palette.info.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 3
            }}
          >
            <InfoIcon sx={{ fontSize: 60, color: theme.palette.info.main }} />
          </Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
            Trash is Empty
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500 }}>
            Deleted calendars will appear here. You'll have 30 days to restore them before they're permanently deleted.
          </Typography>
        </Box>
      ) : (
        <>
          <Alert
            severity="warning"
            icon={<ScheduleIcon />}
            sx={{
              mb: 4,
              borderRadius: 2,
              '& .MuiAlert-message': {
                width: '100%'
              }
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Items will be permanently deleted after 30 days
            </Typography>
            <Typography variant="body2">
              Restore calendars before they're automatically removed. This action cannot be undone after deletion.
            </Typography>
          </Alert>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)'
              },
              gap: 3
            }}
          >
            {trashCalendars.map((calendar) => {
              const daysLeft = getDaysUntilDeletion(calendar.auto_delete_at);
              const statusColor = getDeletionStatusColor(daysLeft);

              return (
                <Card
                  key={calendar.id}
                  sx={{
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    height: 'auto',
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: alpha(theme.palette.divider, 0.1),
                    background: theme.palette.mode === 'dark'
                      ? `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.default, 0.98)} 100%)`
                      : `linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.98) 100%)`,
                    backdropFilter: 'blur(10px)',
                    boxShadow: `0 4px 20px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.3 : 0.08)}`,
                    '&:hover': {
                      transform: 'translateY(-8px) scale(1.02)',
                      boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.4 : 0.15)}`,
                      borderColor: alpha(statusColor, 0.3),
                      '& .hero-image': {
                        transform: 'scale(1.05)'
                      }
                    }
                  }}
                >
                  {/* Hero Image Section */}
                  <Box
                    sx={{
                      position: 'relative',
                      overflow: 'hidden',
                      height: 200,
                      flexShrink: 0
                    }}
                  >
                    <Box
                      className="hero-image"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        ...(calendar.hero_image_url ? {
                          backgroundImage: `url(${calendar.hero_image_url})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                        } : {
                          background: `linear-gradient(135deg,
                            ${alpha(statusColor, 0.2)} 0%,
                            ${alpha(statusColor, 0.1)} 50%,
                            ${alpha(statusColor, 0.05)} 100%)`,
                        }),
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: calendar.hero_image_url
                            ? `linear-gradient(135deg, ${alpha(theme.palette.common.black, 0.3)} 0%, ${alpha(theme.palette.common.black, 0.2)} 50%, ${alpha(theme.palette.common.black, 0.5)} 100%)`
                            : 'transparent',
                          zIndex: 1,
                          transition: 'background 0.4s ease'
                        }
                      }}
                    />

                    {/* Placeholder content for calendars without hero images */}
                    {!calendar.hero_image_url && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 2,
                          textAlign: 'center',
                          color: alpha(theme.palette.text.secondary, 0.6)
                        }}
                      >
                        <CalendarIcon sx={{ fontSize: '3rem', mb: 1, opacity: 0.4 }} />
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 500,
                            opacity: 0.7,
                            fontSize: '0.9rem'
                          }}
                        >
                          {calendar.name}
                        </Typography>
                      </Box>
                    )}

                    {/* Days Until Deletion Badge */}
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 3,
                        backgroundColor: alpha(statusColor, 0.95),
                        backdropFilter: 'blur(8px)',
                        color: 'white',
                        px: 2,
                        py: 1,
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.common.white, 0.2)}`,
                        boxShadow: `0 4px 12px ${alpha(statusColor, 0.4)}`
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                        {daysLeft}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        {daysLeft === 1 ? 'day left' : 'days left'}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Content Section */}
                  <CardContent sx={{
                    p: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    flexGrow: 1,
                    position: 'relative',
                    zIndex: 1
                  }}>
                    {/* Title section */}
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 700,
                          color: 'text.primary',
                          mb: 0.5,
                          fontSize: '1.4rem',
                          letterSpacing: '-0.02em',
                          lineHeight: 1.2
                        }}
                        noWrap
                      >
                        {calendar.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Deleted {format(calendar.deleted_at, 'MMM dd, yyyy')}
                      </Typography>
                    </Box>

                    {/* Stats section */}
                    <Box
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 2,
                        p: 2,
                        borderRadius: 2,
                        bgcolor: alpha(theme.palette.background.default, 0.6)
                      }}
                    >
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Balance
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          ${calendar.account_balance.toLocaleString()}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Trades
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {calendar.total_trades || 0}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>

                  {/* Card Actions */}
                  <CardActions
                    sx={{
                      p: 2,
                      pt: 0,
                      gap: 1,
                      flexDirection: 'column'
                    }}
                  >
                    <Button
                      startIcon={actionLoading === calendar.id ? <CircularProgress size={16} /> : <RestoreIcon />}
                      onClick={() => openConfirmDialog('restore', calendar)}
                      disabled={actionLoading === calendar.id}
                      variant="contained"
                      fullWidth
                      sx={{
                        py: 1.25,
                        fontWeight: 600,
                        textTransform: 'none',
                        borderRadius: 2
                      }}
                    >
                      Restore Calendar
                    </Button>
                    <Button
                      startIcon={<DeleteForeverIcon />}
                      onClick={() => openConfirmDialog('delete', calendar)}
                      disabled={actionLoading === calendar.id}
                      variant="outlined"
                      color="error"
                      fullWidth
                      sx={{
                        py: 1,
                        fontWeight: 500,
                        textTransform: 'none',
                        borderRadius: 2
                      }}
                    >
                      Delete Forever
                    </Button>
                  </CardActions>
                </Card>
              );
            })}
          </Box>
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={closeConfirmDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {confirmDialog.action === 'restore' ? 'Restore Calendar?' : 'Delete Calendar Forever?'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {confirmDialog.calendar && (
            <Box>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {confirmDialog.action === 'restore'
                  ? `Restore "${confirmDialog.calendar.name}" to your active calendars?`
                  : `Permanently delete "${confirmDialog.calendar.name}"?`
                }
              </Typography>

              {confirmDialog.action === 'delete' && (
                <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    This action cannot be undone
                  </Typography>
                  <Typography variant="body2">
                    All trades, images, and data will be permanently lost.
                  </Typography>
                </Alert>
              )}

              {confirmDialog.action === 'restore' && (
                <Alert severity="success" variant="outlined" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2">
                    The calendar will be restored to your calendars list.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={closeConfirmDialog}
            disabled={actionLoading !== null}
            variant="outlined"
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (confirmDialog.calendar) {
                if (confirmDialog.action === 'restore') {
                  handleRestore(confirmDialog.calendar);
                } else {
                  handlePermanentDelete(confirmDialog.calendar);
                }
              }
            }}
            color={confirmDialog.action === 'restore' ? 'primary' : 'error'}
            variant="contained"
            disabled={actionLoading !== null}
            startIcon={actionLoading === confirmDialog.calendar?.id ? <CircularProgress size={16} /> : undefined}
            sx={{ textTransform: 'none', fontWeight: 600, minWidth: 120 }}
          >
            {confirmDialog.action === 'restore' ? 'Restore' : 'Delete Forever'}
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </>
  );
};

export default CalendarTrash;
