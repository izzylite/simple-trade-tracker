import React, { useMemo, useState, useCallback } from 'react';
import {
  Box, Typography, useTheme, useMediaQuery, Tooltip, alpha
} from '@mui/material';
import {
  startOfYear, endOfYear, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, format, isToday,
  startOfWeek, differenceInCalendarWeeks
} from 'date-fns';
import { Trade } from '../../types/dualWrite';
import { TimePeriod } from '../../utils/chartDataUtils';
import { formatValue } from '../../utils/formatters';

interface PnLHeatmapProps {
  trades: Trade[];
  timePeriod: TimePeriod;
  selectedDate: Date;
  setMultipleTradesDialog: (dialogState: any) => void;
}

interface DayData {
  date: Date;
  pnl: number;
  tradeCount: number;
  trades: Trade[];
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const CELL_SIZE = 14;
const CELL_GAP = 2;
const CELL_SIZE_XS = 10;
const CELL_GAP_XS = 1;

function getIntensityColor(
  pnl: number,
  maxWin: number,
  maxLoss: number,
  successColor: string,
  errorColor: string
): string {
  if (pnl === 0) return 'transparent';

  const isWin = pnl > 0;
  const baseColor = isWin ? successColor : errorColor;
  const magnitude = Math.abs(pnl);
  const maxMagnitude = isWin ? maxWin : maxLoss;

  if (maxMagnitude === 0) return alpha(baseColor, 0.3);

  const ratio = Math.min(magnitude / maxMagnitude, 1);

  if (ratio <= 0.25) return alpha(baseColor, 0.25);
  if (ratio <= 0.5) return alpha(baseColor, 0.45);
  if (ratio <= 0.75) return alpha(baseColor, 0.65);
  return alpha(baseColor, 0.9);
}

const PnLHeatmap: React.FC<PnLHeatmapProps> = ({
  trades,
  timePeriod,
  selectedDate,
  setMultipleTradesDialog
}) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';

  const cellSize = isXs ? CELL_SIZE_XS : CELL_SIZE;
  const cellGap = isXs ? CELL_GAP_XS : CELL_GAP;

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const { days, weeks, monthLabels, maxWin, maxLoss } = useMemo(() => {
    // Determine date range based on time period
    let rangeStart: Date;
    let rangeEnd: Date;

    if (timePeriod === 'month') {
      rangeStart = startOfMonth(selectedDate);
      rangeEnd = endOfMonth(selectedDate);
    } else if (timePeriod === 'year') {
      rangeStart = startOfYear(selectedDate);
      rangeEnd = endOfYear(selectedDate);
    } else {
      // "all" — use the year of the selected date
      rangeStart = startOfYear(selectedDate);
      rangeEnd = endOfYear(selectedDate);
    }

    // Build trade lookup by date string
    const tradeLookup = new Map<string, { pnl: number; trades: Trade[] }>();
    trades.forEach(trade => {
      const key = format(new Date(trade.trade_date), 'yyyy-MM-dd');
      const existing = tradeLookup.get(key);
      if (existing) {
        existing.pnl += trade.amount;
        existing.trades.push(trade);
      } else {
        tradeLookup.set(key, { pnl: trade.amount, trades: [trade] });
      }
    });

    // Generate all days in range
    const allDays = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    let mxWin = 0;
    let mxLoss = 0;

    const dayDataList: DayData[] = allDays.map(date => {
      const key = format(date, 'yyyy-MM-dd');
      const data = tradeLookup.get(key);
      const pnl = data?.pnl ?? 0;
      const tradeList = data?.trades ?? [];

      if (pnl > mxWin) mxWin = pnl;
      if (pnl < 0 && Math.abs(pnl) > mxLoss) mxLoss = Math.abs(pnl);

      return { date, pnl, tradeCount: tradeList.length, trades: tradeList };
    });

    // Organize into weeks (columns)
    // Week starts on Sunday (getDay: 0=Sun, 1=Mon, ..., 6=Sat)
    // But we display Mon at top row 0, Sun at row 6
    const weekMap = new Map<number, DayData[]>();
    const weekStart = startOfWeek(rangeStart, { weekStartsOn: 1 });

    dayDataList.forEach(day => {
      const weekIdx = differenceInCalendarWeeks(
        day.date, weekStart, { weekStartsOn: 1 }
      );
      if (!weekMap.has(weekIdx)) {
        weekMap.set(weekIdx, []);
      }
      weekMap.get(weekIdx)!.push(day);
    });

    const weekCount = Math.max(...Array.from(weekMap.keys())) + 1;
    const weekArray: (DayData | null)[][] = [];

    for (let w = 0; w < weekCount; w++) {
      const week: (DayData | null)[] = Array(7).fill(null);
      const daysInWeek = weekMap.get(w) || [];
      daysInWeek.forEach(day => {
        // Convert to Mon=0 ... Sun=6
        const jsDay = getDay(day.date); // 0=Sun
        const row = jsDay === 0 ? 6 : jsDay - 1;
        week[row] = day;
      });
      weekArray.push(week);
    }

    // Month labels positioned at the first week of each month
    const labels: { label: string; weekIdx: number }[] = [];
    const seenMonths = new Set<string>();

    dayDataList.forEach(day => {
      const monthKey = format(day.date, 'yyyy-MM');
      if (!seenMonths.has(monthKey) && day.date.getDate() <= 7) {
        const weekIdx = differenceInCalendarWeeks(
          day.date, weekStart, { weekStartsOn: 1 }
        );
        seenMonths.add(monthKey);
        labels.push({
          label: format(day.date, 'MMM'),
          weekIdx
        });
      }
    });

    return {
      days: dayDataList,
      weeks: weekArray,
      monthLabels: labels,
      maxWin: mxWin,
      maxLoss: mxLoss
    };
  }, [trades, timePeriod, selectedDate]);

  const handleCellClick = useCallback((day: DayData) => {
    if (day.trades.length === 0) return;

    setMultipleTradesDialog({
      open: true,
      trades: day.trades,
      showChartInfo: true,
      title: `Trades on ${format(day.date, 'EEEE, MMM d, yyyy')}`,
      subtitle: `${day.tradeCount} trade${day.tradeCount !== 1 ? 's' : ''} | P&L: ${formatValue(day.pnl)}`,
      expandedTradeId: day.trades.length === 1 ? day.trades[0].id : null
    });
  }, [setMultipleTradesDialog]);

  const emptyColor = isDark
    ? 'rgba(255,255,255,0.04)'
    : 'rgba(0,0,0,0.04)';

  const labelWidth = isXs ? 20 : 32;
  const gridWidth = weeks.length * (cellSize + cellGap);
  const totalWidth = labelWidth + gridWidth;

  return (
    <Box>
      <Box sx={{
        overflowX: 'auto',
        pb: 1,
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': {
          borderRadius: 2,
          bgcolor: isDark ? 'rgba(148,163,184,0.3)' : 'rgba(100,116,139,0.3)'
        }
      }}>
        <Box sx={{
          display: 'inline-flex',
          flexDirection: 'column',
          minWidth: totalWidth
        }}>
          {/* Month labels row */}
          <Box sx={{
            display: 'flex',
            ml: `${labelWidth}px`,
            mb: 0.5,
            height: 14,
            position: 'relative'
          }}>
            {monthLabels.map(({ label, weekIdx }) => (
              <Typography
                key={`${label}-${weekIdx}`}
                variant="caption"
                sx={{
                  position: 'absolute',
                  left: weekIdx * (cellSize + cellGap),
                  fontSize: isXs ? '0.6rem' : '0.7rem',
                  color: 'text.secondary',
                  lineHeight: 1,
                  userSelect: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                {label}
              </Typography>
            ))}
          </Box>

          {/* Grid: day labels + cells */}
          <Box sx={{ display: 'flex', position: 'relative' }}>
            {/* Day-of-week labels */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${cellGap}px`,
              mr: `${cellGap}px`,
              width: labelWidth,
              flexShrink: 0
            }}>
              {DAY_LABELS.map((label, i) => (
                <Box
                  key={i}
                  sx={{
                    height: cellSize,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    pr: 0.5
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: isXs ? '0.55rem' : '0.65rem',
                      color: 'text.secondary',
                      lineHeight: 1,
                      userSelect: 'none'
                    }}
                  >
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {/* Week columns */}
            <Box sx={{ display: 'flex', gap: `${cellGap}px` }}>
              {weeks.map((week, weekIdx) => (
                <Box
                  key={weekIdx}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: `${cellGap}px`
                  }}
                >
                  {week.map((day, dayIdx) => {
                    if (!day) {
                      return (
                        <Box
                          key={dayIdx}
                          sx={{
                            width: cellSize,
                            height: cellSize,
                            borderRadius: '2px'
                          }}
                        />
                      );
                    }

                    const dateKey = format(day.date, 'yyyy-MM-dd');
                    const hasData = day.tradeCount > 0;
                    const bgColor = hasData
                      ? getIntensityColor(
                          day.pnl, maxWin, maxLoss,
                          theme.palette.success.main,
                          theme.palette.error.main
                        )
                      : emptyColor;

                    const isHovered = hoveredDate === dateKey;
                    const isTodayDate = isToday(day.date);

                    return (
                      <Tooltip
                        key={dayIdx}
                        title={
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography
                              variant="caption"
                              sx={{
                                display: 'block',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}
                            >
                              {format(day.date, 'EEE, MMM d, yyyy')}
                            </Typography>
                            {hasData ? (
                              <>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'block',
                                    color: day.pnl >= 0
                                      ? theme.palette.success.main
                                      : theme.palette.error.main,
                                    fontWeight: 700
                                  }}
                                >
                                  {day.pnl >= 0 ? '+' : ''}
                                  {formatValue(day.pnl)}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{ fontSize: '0.65rem' }}
                                >
                                  {day.tradeCount} trade
                                  {day.tradeCount !== 1 ? 's' : ''}
                                </Typography>
                              </>
                            ) : (
                              <Typography
                                variant="caption"
                                sx={{ fontSize: '0.65rem' }}
                              >
                                No trades
                              </Typography>
                            )}
                          </Box>
                        }
                        arrow
                        placement="top"
                        enterDelay={100}
                        leaveDelay={0}
                      >
                        <Box
                          onMouseEnter={() => setHoveredDate(dateKey)}
                          onMouseLeave={() => setHoveredDate(null)}
                          onClick={() => handleCellClick(day)}
                          sx={{
                            width: cellSize,
                            height: cellSize,
                            borderRadius: '2px',
                            bgcolor: bgColor,
                            border: isTodayDate
                              ? `1.5px solid ${theme.palette.primary.main}`
                              : isHovered
                                ? `1px solid ${alpha(
                                    theme.palette.text.primary, 0.3
                                  )}`
                                : '1px solid transparent',
                            cursor: hasData ? 'pointer' : 'default',
                            transition: 'border-color 0.15s ease',
                            '&:hover': {
                              opacity: hasData ? 0.85 : 1
                            }
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>

          {/* Legend */}
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 1.5,
            ml: `${labelWidth}px`
          }}>
            <Typography
              variant="caption"
              sx={{
                fontSize: isXs ? '0.6rem' : '0.65rem',
                color: 'text.secondary',
                mr: 0.5
              }}
            >
              Loss
            </Typography>
            {[0.9, 0.65, 0.45, 0.25].map((a, i) => (
              <Box
                key={`loss-${i}`}
                sx={{
                  width: cellSize - 2,
                  height: cellSize - 2,
                  borderRadius: '2px',
                  bgcolor: alpha(theme.palette.error.main, a)
                }}
              />
            ))}
            <Box
              sx={{
                width: cellSize - 2,
                height: cellSize - 2,
                borderRadius: '2px',
                bgcolor: emptyColor,
                mx: 0.25
              }}
            />
            {[0.25, 0.45, 0.65, 0.9].map((a, i) => (
              <Box
                key={`win-${i}`}
                sx={{
                  width: cellSize - 2,
                  height: cellSize - 2,
                  borderRadius: '2px',
                  bgcolor: alpha(theme.palette.success.main, a)
                }}
              />
            ))}
            <Typography
              variant="caption"
              sx={{
                fontSize: isXs ? '0.6rem' : '0.65rem',
                color: 'text.secondary',
                ml: 0.5
              }}
            >
              Win
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(PnLHeatmap);
