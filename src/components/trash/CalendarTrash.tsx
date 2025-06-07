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
import { useAuth } from '../../contexts/AuthContext';
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

        <Container maxWidth="lg" sx={{ mt: 4 }}>
          <Box sx={{ mb: 4 }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/')}
                variant="outlined"
                size="small"
              >
                Back to Calendars
              </Button>
              <Box sx={{ flexGrow: 1 }} />
            </Stack>

            
          </Box>

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

      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              variant="outlined"
              size="small"
            >
              Back to Calendars
            </Button>
            <Box sx={{ flexGrow: 1 }} />
          </Stack>

        
      </Box>

      {trashCalendars.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Box
            sx={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              backgroundColor: alpha(theme.palette.success.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3
            }}
          >
            <InfoIcon sx={{ fontSize: 60, color: theme.palette.success.main }} />
          </Box>
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
            Trash is Empty
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            No deleted calendars found. When you delete a calendar, it will appear here and can be restored within 30 days.
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
          >
            Back to Calendars
          </Button>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              backgroundColor: alpha(theme.palette.warning.main, 0.1),
              border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
              borderRadius: 2,
              p: 3,
              mb: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 2
            }}
          >
            <WarningIcon sx={{ color: theme.palette.warning.main, fontSize: 24 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: theme.palette.warning.dark }}>
                Automatic Deletion Warning
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Calendars in trash will be permanently deleted after 30 days. This action cannot be undone.
              </Typography>
            </Box>
          </Box>

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
              const daysLeft = getDaysUntilDeletion(calendar.autoDeleteAt);
              const isExpiringSoon = daysLeft <= 7;

              return (
                <Box key={calendar.id}>
                  <Card
                    sx={{
                      height: '100%',
                      border: isExpiringSoon ? `2px solid ${theme.palette.warning.main}` : `1px solid ${theme.palette.divider}`,
                      borderRadius: 3,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: theme.shadows[8]
                      },
                      position: 'relative',
                      overflow: 'visible'
                    }}
                  >
                    {/* Urgency Badge */}
                    {isExpiringSoon && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: 16,
                          backgroundColor: theme.palette.warning.main,
                          color: 'white',
                          px: 2,
                          py: 0.5,
                          borderRadius: 2,
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          zIndex: 1
                        }}
                      >
                        EXPIRES SOON
                      </Box>
                    )}

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
                              <CalendarIcon sx={{ color: theme.palette.primary.main }} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                              <Typography variant="h6" noWrap sx={{ fontWeight: 'bold' }}>
                                {calendar.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Deleted {format(calendar.deletedAt, 'MMM dd, yyyy')}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>

                        {/* Countdown */}
                        <Box
                          sx={{
                            backgroundColor: alpha(getDeletionStatusColor(daysLeft), 0.1),
                            borderRadius: 2,
                            p: 2,
                            textAlign: 'center'
                          }}
                        >
                          <Box display="flex" alignItems="center" justifyContent="center" gap={1} mb={1}>
                            <ScheduleIcon sx={{ fontSize: 20, color: getDeletionStatusColor(daysLeft) }} />
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: getDeletionStatusColor(daysLeft) }}>
                              {daysLeft}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              days left
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Auto-delete: {format(calendar.autoDeleteAt, 'MMM dd, yyyy')}
                          </Typography>
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
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.success.main }}>
                              ${calendar.accountBalance.toLocaleString()}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Balance
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', color: theme.palette.info.main }}>
                              {calendar.totalTrades || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Trades
                            </Typography>
                          </Box>
                        </Box>
                      </Stack>
                    </CardContent>

                    <CardActions sx={{ p: 3, pt: 0, gap: 1 }}>
                      <Button
                        startIcon={<RestoreIcon />}
                        onClick={() => openConfirmDialog('restore', calendar)}
                        disabled={actionLoading === calendar.id}
                        variant="contained"
                        color="primary"
                        fullWidth
                        sx={{
                          borderRadius: 2,
                          py: 1,
                          fontWeight: 'bold'
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
                          borderRadius: 2,
                          py: 1,
                          fontWeight: 'bold'
                        }}
                      >
                        Delete Forever
                      </Button>
                    </CardActions>
                  </Card>
                </Box>
              );
            })}
          </Box>
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={closeConfirmDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {confirmDialog.action === 'restore' ? 'Restore Calendar' : 'Permanently Delete Calendar'}
        </DialogTitle>
        <DialogContent>
          {confirmDialog.calendar && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {confirmDialog.action === 'restore' 
                  ? `Are you sure you want to restore "${confirmDialog.calendar.name}"?`
                  : `Are you sure you want to permanently delete "${confirmDialog.calendar.name}"?`
                }
              </Typography>
              
              {confirmDialog.action === 'delete' && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  This action cannot be undone. All trades, images, and data associated with this calendar will be permanently lost.
                </Alert>
              )}
              
              {confirmDialog.action === 'restore' && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  The calendar will be restored to your active calendars list.
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} disabled={actionLoading !== null}>
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
