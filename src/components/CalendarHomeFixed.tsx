import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Card, 
  CardContent, 
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useTheme,
  alpha,
  Container,
  Stack,
  Divider
} from '@mui/material';
import { 
  Add as AddIcon, 
  CalendarToday as CalendarIcon,
  Delete as DeleteIcon,
  TrendingUp,
  EmojiEvents,
  CalendarMonth
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar'; 
import { dialogProps } from '../styles/dialogStyles';

interface CalendarHomeProps {
  calendars: Calendar[];
  onCreateCalendar: (name: string, accountBalance: number, maxDailyDrawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number) => void;
  onDeleteCalendar: (id: string) => void;
}

export const CalendarHome: React.FC<CalendarHomeProps> = ({ 
  calendars, 
  onCreateCalendar, 
  onDeleteCalendar 
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const theme = useTheme();
  const navigate = useNavigate();

  const handleCreateCalendar = () => {
    if (newCalendarName.trim()) {
      onCreateCalendar(newCalendarName.trim(), 0, 0);
      setNewCalendarName('');
      setIsCreateDialogOpen(false);
    }
  };

  const handleCalendarClick = (calendarId: string) => {
    navigate(`/calendar/${calendarId}`);
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        mb: 4
      }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          My Trading Calendars
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsCreateDialogOpen(true)}
          sx={{
            bgcolor: 'primary.main',
            '&:hover': {
              bgcolor: 'primary.dark'
            }
          }}
        >
          New Calendar
        </Button>
      </Box>

      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 3
      }}>
        {calendars.map((calendar) => (
          <Box key={calendar.id}>
            <Card 
              sx={{ 
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[4]
                }
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CalendarIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6" component="div">
                    {calendar.name}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Created: {format(calendar.createdAt, 'MMM d, yyyy')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Last modified: {format(calendar.lastModified, 'MMM d, yyyy')}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <Button 
                  size="small" 
                  onClick={() => handleCalendarClick(calendar.id)}
                  sx={{ 
                    color: 'primary.main',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  }}
                >
                  Open Calendar
                </Button>
                <IconButton 
                  size="small" 
                  onClick={() => onDeleteCalendar(calendar.id)}
                  sx={{ 
                    color: 'error.main',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.error.main, 0.08)
                    }
                  }}
                >
                  <DeleteIcon />
                </IconButton>
              </CardActions>
            </Card>
          </Box>
        ))}
      </Box>

      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Calendar</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Calendar Name"
            fullWidth
            value={newCalendarName}
            onChange={(e) => setNewCalendarName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateCalendar();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateCalendar}
            variant="contained"
            disabled={!newCalendarName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarHome; 