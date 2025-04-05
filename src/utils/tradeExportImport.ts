import { Trade } from '../types/trade';
import { format, parse } from 'date-fns';
import * as XLSX from 'xlsx';

export const exportTrades = (trades: Trade[], initialBalance: number = 0): void => {
  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate cumulative P&L and account balance
  let cumulativePnL = 0;
  let currentBalance = initialBalance;
  const tradesWithBalances = sortedTrades.map(trade => {
    cumulativePnL += trade.amount;
    currentBalance += trade.amount;
    return {
      ...trade,
      cumulativePnL,
      accountBalance: currentBalance
    };
  });

  // Transform trades into a format suitable for Excel
  const excelData = tradesWithBalances.map(trade => ({
    Date: format(new Date(trade.date), 'MM/dd/yyyy'),
    Type: trade.type.charAt(0).toUpperCase() + trade.type.slice(1),
    Amount: trade.amount,
    'P&L': trade.amount > 0 ? `+${trade.amount.toFixed(2)}` : trade.amount.toFixed(2),
    'Cumulative P&L': trade.cumulativePnL > 0 ? `+${trade.cumulativePnL.toFixed(2)}` : trade.cumulativePnL.toFixed(2),
    'Account Balance': trade.accountBalance.toFixed(2),
    'Journal Link': trade.journalLink || ''
  }));

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 8 },  // Type
    { wch: 10 }, // Amount
    { wch: 10 }, // P&L
    { wch: 15 }, // Cumulative P&L
    { wch: 15 }, // Account Balance
    { wch: 40 }  // Journal Link
  ];
  ws['!cols'] = colWidths;

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Trades');

  // Generate Excel file
  const fileName = `trades_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const importTrades = async (file: File): Promise<Trade[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        // Handle Excel import
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const trades: Trade[] = jsonData.map((row: any) => {
          // Parse date from Excel format (MM/dd/yyyy)
          const date = parse(row.Date, 'MM/dd/yyyy', new Date());
          
          // Handle both the Amount and P&L columns
          const amount = row.Amount || parseFloat(row['P&L']);
          
          return {
            id: crypto.randomUUID(),
            date,
            type: amount > 0 ? 'win' : 'loss',
            amount: amount,
            ...(row['Journal Link'] && { journalLink: row['Journal Link'] })
          };
        });

        resolve(trades);
      } catch (error) {
        reject(new Error('Failed to parse import file. Please ensure the file format is correct.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read import file.'));
    };

    reader.readAsArrayBuffer(file);
  });
}; 