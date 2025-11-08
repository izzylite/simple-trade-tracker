import React from 'react';
import {
  Paper,
  Typography,
  useTheme,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Tooltip,
  TablePagination
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { InfoOutlined, TrendingUp, TrendingDown, TrendingFlat } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { Trade } from '../../types/dualWrite';
import { formatValue } from '../../utils/formatters';
import { scrollbarStyles } from '../../styles/scrollbarStyles';

interface DailySummaryTableProps {
  dailySummaryData: any[];
  trades: Trade[];
  setMultipleTradesDialog: (dialogState: any) => void;
}

const DailySummaryTable: React.FC<DailySummaryTableProps> = ({
  dailySummaryData,
  trades,
  setMultipleTradesDialog
}) => {
  const theme = useTheme();

  // Pagination state
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(10);

  // Calculate total PnL from dailySummaryData
  const totalPnL = React.useMemo(() => {
    if (!dailySummaryData || dailySummaryData.length === 0) return 0;
    return dailySummaryData.reduce((sum, day) => sum + day.pnl, 0);
  }, [dailySummaryData]);

  // Paginated data
  const paginatedData = React.useMemo(() => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return dailySummaryData.slice(startIndex, endIndex);
  }, [dailySummaryData, page, rowsPerPage]);

  // Handle page change
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Reset page when data changes
  React.useEffect(() => {
    setPage(0);
  }, [dailySummaryData.length]);

  return (
    <Paper sx={{ p: 3, borderRadius: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">Daily Summary</Typography>
          <Tooltip
            title="Daily trading summary showing trades, session, and P&L for each day"
            arrow
            placement="top"
          >
            <InfoOutlined sx={{ fontSize: 16, color: 'text.secondary', opacity: 0.7, cursor: 'help' }} />
          </Tooltip>
        </Box>
        {dailySummaryData && dailySummaryData.length > 0 && (
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: alpha(
              totalPnL > 0
                ? theme.palette.success.main
                : totalPnL < 0
                ? theme.palette.error.main
                : theme.palette.grey[500],
              0.1
            ),
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            border: `1px solid ${alpha(
              totalPnL > 0
                ? theme.palette.success.main
                : totalPnL < 0
                ? theme.palette.error.main
                : theme.palette.grey[500],
              0.2
            )}`,
          }}>
          {totalPnL > 0 ? (
            <TrendingUp sx={{ color: theme.palette.success.main }} />
          ) : totalPnL < 0 ? (
            <TrendingDown sx={{ color: theme.palette.error.main }} />
          ) : (
            <TrendingFlat sx={{ color: theme.palette.grey[500] }} />
          )}
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: totalPnL > 0
                ? theme.palette.success.main
                : totalPnL < 0
                ? theme.palette.error.main
                : 'text.secondary'
            }}
          >
            Total P&L: {formatValue(totalPnL)}
          </Typography>
        </Box>
        )}
      </Box>
      <TableContainer sx={{
        flex: 1,
        overflow: 'auto',
        ...scrollbarStyles(theme)
      }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `2px solid ${theme.palette.divider}`,
                  color: 'text.secondary'
                }}
              >
                DATE
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `2px solid ${theme.palette.divider}`,
                  color: 'text.secondary'
                }}
              >
                TRADES
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `2px solid ${theme.palette.divider}`,
                  color: 'text.secondary'
                }}
              >
                SESSION
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `2px solid ${theme.palette.divider}`,
                  color: 'text.secondary'
                }}
              >
                P/L
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row, index) => {
              // Ensure trade_date is a valid Date object
              const tradeDate = new Date(row.trade_date);

              // Skip invalid dates
              if (!isValid(tradeDate)) {
                console.error('Invalid trade_date in dailySummaryData:', row);
                return null;
              }

              return (
                <TableRow
                  key={format(tradeDate, 'yyyy-MM-dd')}
                  onClick={() => {
                    const dayTrades = trades.filter(trade =>
                      format(new Date(trade.trade_date), 'yyyy-MM-dd') === format(tradeDate, 'yyyy-MM-dd')
                    );
                    if (dayTrades.length > 0) {
                      setMultipleTradesDialog({
                        open: true,
                        trades: dayTrades,
                        date: format(tradeDate, 'dd/MM/yyyy'),
                        expandedTradeId: dayTrades.length === 1 ? dayTrades[0].id : null
                      });
                    }
                  }}
                  sx={{
                    '&:last-child td, &:last-child th': { border: 0 },
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.04),
                      cursor: 'pointer'
                    },
                    bgcolor: row.pnl > 0
                      ? alpha(theme.palette.success.main, 0.05)
                      : row.pnl < 0
                      ? alpha(theme.palette.error.main, 0.05)
                      : 'transparent'
                  }}
                >
                  <TableCell
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary'
                    }}
                  >
                    {format(tradeDate, 'dd/MM/yyyy')}
                  </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    fontWeight: 500,
                    color: 'text.primary'
                  }}
                >
                  {row.trades}
                </TableCell>
                <TableCell align="center">
                  {row.session ? (
                    <Typography
                      sx={{
                        color: 'text.primary',
                        fontWeight: 500
                      }}
                    >
                      {row.session}
                    </Typography>
                  ) : (
                    <Typography
                      sx={{
                        color: 'text.secondary',
                        fontStyle: 'italic'
                      }}
                    >
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell
                  align="right"
                  sx={{
                    color: row.pnl > 0
                      ? theme.palette.success.main
                      : row.pnl < 0
                      ? theme.palette.error.main
                      : 'text.secondary',
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}
                >
                  {formatValue(row.pnl)}
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 25, 50]}
        component="div"
        count={dailySummaryData.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          '.MuiTablePagination-toolbar': {
            minHeight: 52
          }
        }}
      />
    </Paper>
  );
};

export default DailySummaryTable;
