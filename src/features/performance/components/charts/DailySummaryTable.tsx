import React from 'react';
import {
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
import { InfoOutlined, CalendarMonth } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { Trade } from 'features/calendar/types/dualWrite';
import { formatValue, formatCount } from 'utils/formatters';
import { scrollbarStyles } from 'styles/scrollbarStyles';
import { EYEBROW_SX, TNUM, getInsetSurface } from 'styles/designTokens';
import CardShell from 'components/common/CardShell';
import PnlValue from 'components/common/PnlValue';

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
  const radius = theme.palette.custom.radius;
  const insetBg = getInsetSurface(theme);

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

  const totalChip =
    dailySummaryData && dailySummaryData.length > 0 ? (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.75,
          bgcolor: insetBg,
          border: `1px solid ${theme.palette.divider}`,
          px: 1.25,
          py: 0.625,
          borderRadius: `${radius.md}px`,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ ...EYEBROW_SX, color: 'text.tertiary' }}>
          Total
        </Typography>
        <PnlValue amount={totalPnL} format={formatValue} size="sm" bold />
      </Box>
    ) : undefined;

  return (
    <CardShell
      sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      head={{
        icon: <CalendarMonth sx={{ fontSize: 16 }} />,
        title: (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span">Daily Summary</Box>
            <Tooltip
              title="Daily trading summary showing trades, session, and P&L for each day"
              arrow
              placement="top"
            >
              <InfoOutlined
                sx={{ fontSize: 14, color: 'text.tertiary', cursor: 'help' }}
              />
            </Tooltip>
          </Box>
        ),
        right: totalChip,
      }}
    >
      {/* Table body */}
      <TableContainer
        sx={{
          flex: 1,
          overflow: 'auto',
          ...scrollbarStyles(theme),
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell
                sx={{
                  ...EYEBROW_SX,
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  py: 1.25,
                }}
              >
                Date
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  ...EYEBROW_SX,
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  py: 1.25,
                }}
              >
                Trades
              </TableCell>
              <TableCell
                align="center"
                sx={{
                  ...EYEBROW_SX,
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  py: 1.25,
                }}
              >
                Session
              </TableCell>
              <TableCell
                align="right"
                sx={{
                  ...EYEBROW_SX,
                  fontWeight: 600,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                  py: 1.25,
                }}
              >
                P/L
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedData.map((row) => {
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
                    '& td, & th': {
                      borderBottom: `1px solid ${theme.palette.divider}`,
                    },
                    '&:last-child td, &:last-child th': { border: 0 },
                    '&:hover': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.04),
                      cursor: 'pointer',
                    },
                  }}
                >
                  <TableCell
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary',
                      fontFeatureSettings: TNUM,
                    }}
                  >
                    {format(tradeDate, 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 500,
                      color: 'text.primary',
                      fontFeatureSettings: TNUM,
                    }}
                  >
                    {formatCount(row.trades)}
                  </TableCell>
                  <TableCell align="center">
                    {row.session ? (
                      <Typography
                        sx={{
                          color: 'text.primary',
                          fontWeight: 500,
                          fontSize: '0.85rem',
                        }}
                      >
                        {row.session}
                      </Typography>
                    ) : (
                      <Typography
                        sx={{
                          color: 'text.tertiary',
                          fontStyle: 'italic',
                          fontSize: '0.85rem',
                        }}
                      >
                        —
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ py: 1 }}>
                    <PnlValue
                      amount={row.pnl}
                      format={formatValue}
                      size="sm"
                      arrow={false}
                      bold
                    />
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
            minHeight: 52,
          },
          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
            fontFeatureSettings: TNUM,
            color: 'text.secondary',
          },
        }}
      />
    </CardShell>
  );
};

export default DailySummaryTable;
