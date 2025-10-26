import { Trade } from '../types/dualWrite';
import { format, parse } from 'date-fns';
import * as XLSX from 'xlsx';
import { error, warn } from './logger';

// Helper function to prepare trade data for export
const prepareTradeDataForExport = (trades: Trade[], initial_balance: number = 0) => {
  // Sort trades by date
  const sortedTrades = [...trades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

  // Calculate cumulative P&L and account balance
  let cumulativePnL = 0;
  let currentBalance = initial_balance;
  const tradesWithBalances = sortedTrades.map(trade => {
    cumulativePnL += trade.amount;
    currentBalance += trade.amount;
    return {
      ...trade,
      cumulativePnL,
      accountBalance: currentBalance
    };
  });

  // Transform trades into a format suitable for export
  return tradesWithBalances.map(trade => ({
    Date: format(new Date(trade.trade_date), 'MM/dd/yyyy'),
    Name: trade.name ? trade.name : '',
    Type: trade.trade_type.charAt(0).toUpperCase() + trade.trade_type.slice(1),
    Amount: trade.amount,
    'P&L': trade.amount > 0 ? `+${trade.amount.toFixed(2)}` : trade.amount.toFixed(2),
    'Cumulative P&L': trade.cumulativePnL > 0 ? `+${trade.cumulativePnL.toFixed(2)}` : trade.cumulativePnL.toFixed(2),
    'Account Balance': trade.accountBalance.toFixed(2),
    'Entry Price': trade.entry_price || '',
    'Exit Price': trade.exit_price || '',
    Tags: trade.tags?.join(', ') || '',
    'Risk to Reward': trade.risk_to_reward?.toFixed(2) || '',
    Session: trade.session || '',
    Notes: trade.notes || ''
  }));
};

// Export trades to Excel format
const exportToExcel = (data: any[], fileName: string): void => {
  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  const colWidths = [
    { wch: 12 }, // Date
    { wch: 25 }, // Name
    { wch: 8 },  // Type
    { wch: 10 }, // Amount
    { wch: 10 }, // P&L
    { wch: 15 }, // Cumulative P&L
    { wch: 15 }, // Account Balance
    { wch: 15 }, // Entry Price
    { wch: 15 }, // Exit Price
    { wch: 30 }, // Tags
    { wch: 12 }, // Risk to Reward
    { wch: 12 }, // Session
    { wch: 50 }  // Notes
  ];
  ws['!cols'] = colWidths;

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Trades');

  // Generate Excel file
  XLSX.writeFile(wb, fileName);
};

// Export trades to CSV format
const exportToCsv = (data: any[], fileName: string): void => {
  // Convert data to CSV string
  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Handle values that need to be quoted (contain commas, quotes, or newlines)
      const escaped = String(value).replace(/"/g, '""');
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }

  // Create CSV content
  const csvContent = csvRows.join('\n');

  // Create a blob and download the file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Main export function that supports both Excel and CSV formats
export const exportTrades = (trades: Trade[], initial_balance: number = 0, fileFormat: 'xlsx' | 'csv' = 'xlsx'): void => {
  if (trades.length === 0) return;

  // Prepare data for export
  const exportData = prepareTradeDataForExport(trades, initial_balance);

  // Generate file name with current date
  const dateStr = format(new Date(), 'yyyy-MM-dd');
  const fileName = `trades_${dateStr}.${fileFormat}`;

  // Export in the requested format
  if (fileFormat === 'xlsx') {
    exportToExcel(exportData, fileName);
  } else {
    exportToCsv(exportData, fileName);
  }
};

// Import trades from Excel format
const importFromExcel = async (data: ArrayBuffer): Promise<Trade[]> => {
  try {
    const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });

    // Check if the workbook has any sheets
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('Excel file does not contain any sheets');
    }

    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    // Check if the worksheet exists
    if (!worksheet) {
      throw new Error('Excel sheet is empty or invalid');
    }

    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    // Check if we have any data
    if (!jsonData || jsonData.length === 0) {
      throw new Error('No data found in the Excel file');
    }

    // Check if we have the required Date column
    const firstRow = jsonData[0] as any;
    if (!firstRow.Date) {
      throw new Error('Excel file must contain a "Date" column');
    }

    try {
      return parseTradeData(jsonData);
    } catch (parseError) {
      error('Trade data parsing error:', parseError);
      // Provide more specific error messages for common issues
      if (parseError instanceof Error) {
        if (parseError.message.includes('Invalid time value')) {
          throw new Error('Could not parse one or more dates in the Excel file. Please ensure dates are in a standard format like "MM/DD/YYYY" or "Month Day, Year".');
        }
        throw parseError;
      }
      throw new Error('Failed to parse trade data from Excel file.');
    }
  } catch (err) {
    error('Excel parsing error:', err);
    throw err; // Re-throw to be handled by the caller
  }
};

// Import trades from CSV format
const importFromCsv = async (data: string): Promise<Trade[]> => {
  try {
    // Parse CSV string to JSON
    const rows = data.split('\n');

    // Check if we have at least a header row
    if (rows.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse headers
    const headers = rows[0].split(',').map(header => {
      // Remove quotes if present
      return header.replace(/^"|"$/g, '').trim();
    });

    // Check if we have the required Date header
    if (!headers.includes('Date')) {
      throw new Error('CSV file must contain a "Date" column');
    }

    const jsonData = [];

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue; // Skip empty rows

      // Handle quoted values with commas inside
      const values = [];
      let inQuotes = false;
      let currentValue = '';

      try {
        for (let j = 0; j < rows[i].length; j++) {
          const char = rows[i][j];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }

        // Add the last value
        values.push(currentValue);

        // Create object from headers and values
        const obj: any = {};
        for (let j = 0; j < headers.length; j++) {
          if (j < values.length) {
            // Remove quotes if present
            obj[headers[j]] = values[j].replace(/^"|"$/g, '').trim();
          }
        }

        // Only add rows that have a Date value
        if (obj.Date) {
          jsonData.push(obj);
        }
      } catch (err) {
        warn(`Skipping row ${i} due to parsing error:`, err);
        // Continue with the next row
      }
    }

    if (jsonData.length === 0) {
      throw new Error('No valid data rows found in the CSV file');
    }

    try {
      return parseTradeData(jsonData);
    } catch (parseError) {
      error('Trade data parsing error:', parseError);
      // Provide more specific error messages for common issues
      if (parseError instanceof Error) {
        if (parseError.message.includes('Invalid time value')) {
          throw new Error('Could not parse one or more dates in the CSV file. Please ensure dates are in a standard format like "MM/DD/YYYY" or "Month Day, Year".');
        }
        throw parseError;
      }
      throw new Error('Failed to parse trade data from CSV file.');
    }
  } catch (err) {
    error('CSV parsing error:', err);
    throw err; // Re-throw to be handled by the caller
  }
};

// Known trade properties that should not be converted to tags
const knownTradeProperties = [
  'id', 'date', 'Date', 'amount', 'Amount', 'P&L', 'type', 'Type', 'name', 'Name',
  'entry', 'Entry Price', 'exit', 'Exit Price', 'tags', 'Tags', 'riskToReward', 'Risk to Reward',
  'partialsTaken', 'Partials Taken', 'session', 'Session', 'notes', 'Notes',
  'images', 'Images', 'Cumulative P&L', 'Account Balance'
];

// Common date formats to try when parsing
const DATE_FORMATS = [
  'MM/dd/yyyy',    // 01/31/2023
  'M/d/yyyy',      // 1/31/2023
  'yyyy-MM-dd',    // 2023-01-31
  'yyyy/MM/dd',    // 2023/01/31
  'dd/MM/yyyy',    // 31/01/2023
  'dd-MM-yyyy',    // 31-01-2023
  'MM-dd-yyyy',    // 01-31-2023
  'M-d-yyyy',      // 1-31-2023
  'MMMM d, yyyy',  // March 7, 2025
  'MMM d, yyyy',   // Mar 7, 2025
  'MMMM dd, yyyy', // March 07, 2025
  'MMM dd, yyyy'   // Mar 07, 2025
];

// Parse a date string using multiple formats
const parseDate = (dateStr: string): Date => {
  // Normalize the date string to handle potential inconsistencies
  const normalizedDateStr = dateStr.trim();

  // Try to parse with each format
  for (const format of DATE_FORMATS) {
    try {
      const parsedDate = parse(normalizedDateStr, format, new Date());
      // Check if the date is valid (not Invalid Date)
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    } catch (error) {
      // Continue to the next format if this one fails
    }
  }

  // Special handling for month name formats (e.g., "March 7, 2025")
  const monthNameRegex = /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})/i;
  const monthNameMatch = normalizedDateStr.match(monthNameRegex);

  if (monthNameMatch) {
    const [, month, day, year] = monthNameMatch;
    const monthIndex = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ].indexOf(month.toLowerCase());

    if (monthIndex !== -1) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // If all formats fail, try to create a date directly
  const directDate = new Date(normalizedDateStr);
  if (!isNaN(directDate.getTime())) {
    return directDate;
  }

  // If all attempts fail, use the current date and log a warning
  warn(`Could not parse date: ${normalizedDateStr}. Using current date instead.`);
  return new Date();
};

// Parse trade data from JSON format
const parseTradeData = (jsonData: any[]): Trade[] => {
  return jsonData.map((row: any) => {
    // Parse date from various possible formats
    const date = row.Date ? parseDate(row.Date) : new Date();

    // Handle both the Amount and P&L columns
    let amount = 0;
    try {
      amount = row.Amount !== undefined ?
        (typeof row.Amount === 'string' ? parseFloat(row.Amount) : row.Amount) :
        parseFloat(row['P&L'] || '0');
    } catch (err) {
      warn(`Could not parse amount: ${row.Amount || row['P&L']}. Using 0 instead.`);
    }

    // Parse tags from the Tags column
    let tags = row.Tags ? row.Tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) : [];

    // Process unknown headers as tag categories
    for (const header in row) {
      // Skip known properties and empty values
      if (knownTradeProperties.includes(header) || !row[header] || row[header] === '') {
        continue;
      }

      // Convert the header to a tag category
      const categoryName = header.trim();
      const values = String(row[header]).split(',');

      // Add each value as a tag in the format "Category:Value"
      for (const value of values) {
        const trimmedValue = value.trim();
        if (trimmedValue) {
          tags.push(`${categoryName}:${trimmedValue}`);
        }
      }
    }

    // Determine the trade type based on amount or Type column
    let tradeType: 'win' | 'loss' | 'breakeven';
    if (row.Type && typeof row.Type === 'string') {
      const typeStr = row.Type.toLowerCase();
      if (typeStr === 'win' || typeStr === 'loss' || typeStr === 'breakeven') {
        tradeType = typeStr as 'win' | 'loss' | 'breakeven';
      } else {
        // Fallback to amount-based type
        tradeType = amount > 0 ? 'win' : amount < 0 ? 'loss' : 'breakeven';
      }
    } else {
      // Determine type based on amount
      tradeType = amount > 0 ? 'win' : amount < 0 ? 'loss' : 'breakeven';
    }

    return {
      id: crypto.randomUUID(),
      date,
      type: tradeType,
      amount: amount,
      ...(row.Name && { name: row.Name }),
      ...(row['Entry Price'] && { entry: row['Entry Price'] }),
      ...(row['Exit Price'] && { exit: row['Exit Price'] }),

      ...(tags.length > 0 && { tags }),
      ...(row['Risk to Reward'] && { riskToReward: parseFloat(row['Risk to Reward']) }),
      ...(row.Session && { session: row.Session }),
      ...(row.Notes && { notes: row.Notes })
    };
  });
};

// Main import function that supports both Excel and CSV formats
export const importTrades = async (file: File): Promise<Trade[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const fileType = file.name.split('.').pop()?.toLowerCase();

    reader.onload = async (e) => {
      try {
        let trades: Trade[] = [];

        // Handle different file types
        if (fileType === 'csv') {
          // CSV import
          const csvContent = e.target?.result as string;
          trades = await importFromCsv(csvContent);
        } else {
          // Excel import
          const data = e.target?.result as ArrayBuffer;
          trades = await importFromExcel(data);
        }

        resolve(trades);
      } catch (err) {
        error('Import error:', err);
        let errorMessage = 'Failed to parse import file. ';

        if (err instanceof Error) {
          if (err.message.includes('Invalid time value')) {
            errorMessage += 'There was an issue with a date format in your file. Please ensure all dates are in a standard format like MM/DD/YYYY.';
          } else if (err.message.includes('is not a function')) {
            errorMessage += 'There was an issue with the file structure. Please ensure the file has proper headers and data.';
          } else {
            errorMessage += err.message;
          }
        } else {
          errorMessage += 'Please ensure the file format is correct.';
        }

        reject(new Error(errorMessage));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read import file.'));
    };

    // Read file based on type
    if (fileType === 'csv') {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};