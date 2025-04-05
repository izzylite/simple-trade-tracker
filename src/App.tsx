import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, IconButton, useMediaQuery } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import { Brightness4 as DarkModeIcon, Brightness7 as LightModeIcon } from '@mui/icons-material';
import CalendarHome from './components/CalendarHome';
import TradeCalendar from './components/TradeCalendar';
import { Trade } from './types/trade';
import { Calendar } from './types/calendar';
import { v4 as uuidv4 } from 'uuid';

function App() {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [mode, setMode] = useState<'light' | 'dark'>(prefersDarkMode ? 'dark' : 'light');
  const [calendars, setCalendars] = useState<Calendar[]>(() => {
    const savedCalendars = localStorage.getItem('calendars');
    if (savedCalendars) {
      const parsed = JSON.parse(savedCalendars);
      return parsed.map((cal: any) => ({
        ...cal,
        createdAt: new Date(cal.createdAt),
        lastModified: new Date(cal.lastModified),
      }));
    }
    return [];
  });

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: '#1976d2',
        light: '#42a5f5',
        dark: '#1565c0',
      },
      secondary: {
        main: '#dc004e',
        light: '#ff4081',
        dark: '#c51162',
      },
      background: {
        default: mode === 'dark' ? '#121212' : '#f5f5f5',
        paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
    },
    shape: {
      borderRadius: 8,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h5: {
        fontWeight: 500,
      },
      h6: {
        fontWeight: 500,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
        },
      },

      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'dark' 
              ? '0 4px 12px rgba(0,0,0,0.2)' 
              : '0 4px 12px rgba(0,0,0,0.05)',
          },
        },
      },
    },
  }), [mode]);

  useEffect(() => {
    localStorage.setItem('calendars', JSON.stringify(calendars));
  }, [calendars]);

  const handleCreateCalendar = (name: string, accountBalance: number, maxDailyDrawdown: number, weeklyTarget?: number, monthlyTarget?: number, yearlyTarget?: number) => {
    const newCalendar: Calendar = {
      id: uuidv4(),
      name,
      createdAt: new Date(),
      lastModified: new Date(),
      trades: [],
      accountBalance,
      maxDailyDrawdown,
      weeklyTarget,
      monthlyTarget,
      yearlyTarget,
    };
    setCalendars([...calendars, newCalendar]);
  };

  const handleDeleteCalendar = (id: string) => {
    setCalendars(calendars.filter(cal => cal.id !== id));
  };

  const handleUpdateCalendar = (id: string, updates: Partial<Calendar>) => {
    setCalendars(calendars.map(cal => 
      cal.id === id 
        ? { ...cal, ...updates, lastModified: new Date() }
        : cal
    ));
  };

  const toggleColorMode = () => {
    setMode(prevMode => prevMode === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          bgcolor: 'background.default',
          position: 'relative',
          pb: 4
        }}
      >
        <Box
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 1000
          }}
        >
          <IconButton
            onClick={toggleColorMode}
            color="inherit"
            sx={{
              bgcolor: 'background.paper',
              boxShadow: theme.shadows[2],
              '&:hover': {
                bgcolor: 'background.paper',
                transform: 'scale(1.1)',
              },
              transition: 'all 0.15s ease-in-out'
            }}
          >
            {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Box>
        <Router>
          <Routes>
            <Route 
              path="/" 
              element={
                <CalendarHome
                  calendars={calendars}
                  onCreateCalendar={handleCreateCalendar}
                  onDeleteCalendar={handleDeleteCalendar}
                  onUpdateCalendar={handleUpdateCalendar}
                />
              } 
            />
            <Route 
              path="/calendar/:calendarId" 
              element={
                <CalendarRoute 
                  calendars={calendars}
                  onUpdateCalendar={handleUpdateCalendar}
                />
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </Box>
    </ThemeProvider>
  );
}

interface CalendarRouteProps {
  calendars: Calendar[];
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
}

const CalendarRoute: React.FC<CalendarRouteProps> = ({ calendars, onUpdateCalendar }) => {
  const { calendarId } = useParams<{ calendarId: string }>();
  const calendar = calendars.find((c: Calendar) => c.id === calendarId);
  
  if (!calendar) {
    return <Navigate to="/" replace />;
  }

  const handleAddTrade = (trade: Omit<Trade, "id">) => {
    onUpdateCalendar(calendar.id, { 
      trades: [...calendar.trades, { ...trade, id: uuidv4() }] 
    });
  };

  const handleEditTrade = (trade: Trade) => {
    onUpdateCalendar(calendar.id, {
      trades: calendar.trades.map((t: Trade) => t.id === trade.id ? trade : t)
    });
  };

  const handleDeleteTrade = (tradeId: string) => {
    onUpdateCalendar(calendar.id, {
      trades: calendar.trades.filter((t: Trade) => t.id !== tradeId)
    });
  };

  const handleChangeAccountBalance = (newBalance: number) => {
    onUpdateCalendar(calendar.id, { accountBalance: newBalance });
  };

  const handleImportTrades = (importedTrades: Trade[]) => {
    onUpdateCalendar(calendar.id, { trades: importedTrades });
  };

  const handleClearMonthTrades = (month: number, year: number) => {
    const tradesToKeep = calendar.trades.filter(trade => {
      const tradeDate = new Date(trade.date);
      return tradeDate.getMonth() !== month || tradeDate.getFullYear() !== year;
    });
    onUpdateCalendar(calendar.id, { trades: tradesToKeep });
  };

  return (
    <TradeCalendar
      trades={calendar.trades}
      accountBalance={calendar.accountBalance}
      maxDailyDrawdown={calendar.maxDailyDrawdown}
      weeklyTarget={calendar.weeklyTarget}
      monthlyTarget={calendar.monthlyTarget}
      yearlyTarget={calendar.yearlyTarget}
      calendarName={calendar.name}
      onAddTrade={handleAddTrade}
      onEditTrade={handleEditTrade}
      onDeleteTrade={handleDeleteTrade}
      onAccountBalanceChange={handleChangeAccountBalance}
      onImportTrades={handleImportTrades}
      onClearMonthTrades={handleClearMonthTrades}
    />
  );
};

export default App;
