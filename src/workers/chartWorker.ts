/**
 * Chart Worker
 *
 * Web Worker for calculating chart data off the main thread.
 * Uses inline Blob worker approach to avoid build configuration changes.
 */

import { createInlineWorker, WorkerManager } from './utils/workerManager';
import type {
  CalculateChartDataRequest,
  CalculateChartDataResponse,
  WorkerRequest,
  WorkerResponse
} from './types/workerMessages';

/**
 * Worker code that runs in the Web Worker context.
 * This is a string that will be executed in the worker via Blob URL.
 *
 * IMPORTANT: This code cannot import external modules.
 * All dependencies must be inlined or use native APIs.
 */
const CHART_WORKER_CODE = `
// ============================================================================
// Date Utilities (Native implementations to avoid dependencies)
// ============================================================================

function formatDate(date, format) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  if (format === 'MM/dd') {
    return month + '/' + day;
  } else if (format === 'MM/dd/yyyy') {
    return month + '/' + day + '/' + year;
  } else if (format === 'yyyy-MM-dd') {
    return year + '-' + month + '-' + day;
  }
  return date.toISOString();
}

function isSameMonth(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

function startOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function eachDayOfInterval(start, end) {
  const days = [];
  const currentDate = new Date(start);
  const endDate = new Date(end);

  while (currentDate <= endDate) {
    days.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return days;
}

// ============================================================================
// Trade Filtering
// ============================================================================

function getFilteredTrades(trades, selectedDate, timePeriod) {
  const date = new Date(selectedDate);

  switch (timePeriod) {
    case 'month':
      return trades.filter(trade => isSameMonth(new Date(trade.trade_date), date));
    case 'year':
      return trades.filter(trade =>
        new Date(trade.trade_date).getFullYear() === date.getFullYear()
      );
    case 'all':
      return trades;
    default:
      return trades;
  }
}

// ============================================================================
// Chart Data Calculation
// ============================================================================

function calculateChartData(trades, selectedDate, timePeriod) {
  const filteredTrades = getFilteredTrades(trades, selectedDate, timePeriod);
  const date = new Date(selectedDate);

  // Get the date range for the selected period
  let startDate, endDate;
  if (timePeriod === 'month') {
    startDate = startOfMonth(date);
    endDate = endOfMonth(date);
  } else if (timePeriod === 'year') {
    startDate = new Date(date.getFullYear(), 0, 1);
    endDate = new Date(date.getFullYear(), 11, 31);
  } else {
    // For 'all', use the first and last trade dates
    if (filteredTrades.length === 0) {
      startDate = new Date();
      endDate = new Date();
    } else {
      const sortedTrades = [...filteredTrades].sort((a, b) =>
        new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
      );
      startDate = new Date(sortedTrades[0].trade_date);
      endDate = new Date(sortedTrades[sortedTrades.length - 1].trade_date);
    }
  }

  // Generate an array of all days in the period
  const days = eachDayOfInterval(startDate, endDate);

  // Calculate cumulative P&L for each day
  let cumulative = 0;
  let prevCumulative = 0;
  const result = [];

  for (const day of days) {
    // Find trades for this day
    const dayTrades = filteredTrades.filter(trade =>
      formatDate(new Date(trade.trade_date), 'yyyy-MM-dd') === formatDate(day, 'yyyy-MM-dd')
    );

    // Calculate daily P&L
    const dailyPnL = dayTrades.reduce((sum, trade) => sum + trade.amount, 0);

    // Update cumulative P&L
    prevCumulative = cumulative;
    cumulative += dailyPnL;

    result.push({
      date: formatDate(day, timePeriod === 'month' ? 'MM/dd' : 'MM/dd/yyyy'),
      pnl: dailyPnL,
      cumulativePnL: cumulative,
      isIncreasing: cumulative > prevCumulative,
      isDecreasing: cumulative < prevCumulative,
      dailyChange: cumulative - prevCumulative,
      isWin: dailyPnL > 0,
      isLoss: dailyPnL < 0,
      isBreakEven: dailyPnL === 0,
      trades: dayTrades,
      fullDate: day.toISOString() // Serialize Date as ISO string
    });
  }

  return result;
}

// ============================================================================
// Message Handler
// ============================================================================

self.addEventListener('message', (event) => {
  const request = event.data;

  try {
    if (request.type === 'CALCULATE_CHART_DATA') {
      const { trades, selectedDate, timePeriod } = request.payload;

      const chartData = calculateChartData(trades, selectedDate, timePeriod);

      const response = {
        id: request.id,
        type: request.type,
        payload: { chartData }
      };

      self.postMessage(response);
    } else {
      throw new Error('Unknown request type: ' + request.type);
    }
  } catch (error) {
    const response = {
      id: request.id,
      type: request.type,
      error: {
        message: error.message,
        stack: error.stack
      }
    };

    self.postMessage(response);
  }
});
`;

// ============================================================================
// Worker Manager Instance
// ============================================================================

let chartWorkerManager: WorkerManager | null = null;

/**
 * Get or create the chart worker manager instance (singleton)
 */
function getChartWorkerManager(): WorkerManager {
  if (!chartWorkerManager) {
    chartWorkerManager = new WorkerManager(() => createInlineWorker(CHART_WORKER_CODE));
  }
  return chartWorkerManager;
}

/**
 * Calculate chart data using Web Worker
 */
export async function calculateChartDataInWorker(
  trades: Parameters<typeof import('../utils/chartDataUtils').calculateChartData>[0],
  selectedDate: Date,
  timePeriod: Parameters<typeof import('../utils/chartDataUtils').calculateChartData>[2]
): Promise<CalculateChartDataResponse['chartData']> {
  const manager = getChartWorkerManager();

  const request: CalculateChartDataRequest = {
    trades,
    selectedDate: selectedDate.toISOString(),
    timePeriod
  };

  const response = await manager.request<
    CalculateChartDataRequest,
    CalculateChartDataResponse
  >('CALCULATE_CHART_DATA', request);

  // Convert fullDate back from ISO string to Date object
  return response.chartData.map(point => ({
    ...point,
    fullDate: new Date(point.fullDate)
  }));
}

/**
 * Terminate the chart worker (cleanup)
 */
export function terminateChartWorker(): void {
  if (chartWorkerManager) {
    chartWorkerManager.terminate();
    chartWorkerManager = null;
  }
}

/**
 * Check if chart worker is active
 */
export function isChartWorkerActive(): boolean {
  return chartWorkerManager?.isActive() ?? false;
}
