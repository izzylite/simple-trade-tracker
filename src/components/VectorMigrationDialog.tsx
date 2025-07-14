/**
 * Temporary Vector Migration Dialog
 * This component fixes the embedding mismatch by regenerating all trade embeddings
 * using the correct transformer model instead of hash-based embeddings
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  Box,
  Alert,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import { createClient } from '@supabase/supabase-js';
import { embeddingService } from '../services/embeddingService';
import { vectorSearchService } from '../services/vectorSearchService';
import { getAllTrades } from '../services/calendarService';
import { useAuth } from '../contexts/AuthContext';
import { Trade } from '../types/trade';
import { Calendar } from '../types/calendar';
import { logger } from '../utils/logger';

interface MigrationStats {
  totalTrades: number;
  processedTrades: number;
  successCount: number;
  errorCount: number;
  currentYear?: string;
  currentTrade?: string;
}

interface VectorMigrationDialogProps {
  open: boolean;
  onClose: () => void;
  calendar?: Calendar;
}

const VectorMigrationDialog: React.FC<VectorMigrationDialogProps> = ({
  open,
  onClose,
  calendar,
}) => {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [stats, setStats] = useState<MigrationStats>({
    totalTrades: 0,
    processedTrades: 0,
    successCount: 0,
    errorCount: 0,
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<any[]>([]);

  // Create Supabase client with service key for admin access
  const supabaseAdmin = createClient(
    'https://gwubzauelilziaqnsfac.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3dWJ6YXVlbGlsemlhcW5zZmFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NDI0MDMsImV4cCI6MjA2ODAxODQwM30.LkDhWPcJBIJThPPQ-YEmMi_3tl7GMp0lvDoawXehLho'
  );

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    logger.log(message);
  };

  const updateStats = (updates: Partial<MigrationStats>) => {
    setStats(prev => ({ ...prev, ...updates }));
  };

  /**
   * Check what's actually in the database for debugging
   */
  const checkDatabaseContent = async () => {
    if (!user || !calendar) return;

    addLog('🔍 Checking database content...');

    try {
      // Get a few sample embeddings to see what's stored
      const { data, error } = await supabaseAdmin
        .from('trade_embeddings')
        .select('trade_id, embedded_content, trade_date')
        .match({
          user_id: user.uid,
          calendar_id: calendar.id
        })
        .limit(5);

      if (error) {
        addLog(`❌ Database check failed: ${error.message}`);
        return;
      }

      addLog(`✅ Found ${data?.length || 0} sample embeddings in database`);

      if (data && data.length > 0) {
        data.forEach((row, index) => {
          const date = new Date(row.trade_date);
          const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
          addLog(`  ${index + 1}. Trade ${row.trade_id} (${dayOfWeek}): ${row.embedded_content.substring(0, 100)}...`);
        });
      }

      // Test a simple query embedding
      addLog('🔍 Testing query embedding generation...');
      const testQuery = 'monday trades';
      const queryEmbedding = await embeddingService.generateEmbedding(testQuery);
      addLog(`✅ Generated embedding for "${testQuery}" (dimension: ${queryEmbedding.length})`);
      addLog(`   Sample values: [${queryEmbedding.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...]`);

    } catch (error) {
      addLog(`❌ Database content check failed: ${error}`);
    }
  };

  /**
   * Get all trades from all years in the calendar
   */
  const getAllTradesFromCalendar = async (): Promise<Trade[]> => {
    if (!calendar) throw new Error('No calendar selected');

    addLog('Fetching all trades from calendar...');

    try {
      const allTrades = await getAllTrades(calendar.id);
      addLog(`Total trades found: ${allTrades.length}`);
      return allTrades;
    } catch (error) {
      addLog(`Error fetching trades: ${error}`);
      throw error;
    }
  };

  /**
   * Fix embedding for a single trade
   */
  const fixTradeEmbedding = async (trade: Trade): Promise<boolean> => {
    if (!user || !calendar) return false;

    try {
      updateStats({ currentTrade: trade.id });

      // Generate searchable text using the production method
      const content = embeddingService.tradeToSearchableText(trade);

      // Generate embedding using the production transformer model
      const embedding = await embeddingService.generateEmbedding(content);

      // Store in Supabase using admin client
      const { error } = await supabaseAdmin
        .from('trade_embeddings')
        .upsert({
          trade_id: trade.id,
          calendar_id: calendar.id,
          user_id: user.uid,
          trade_type: trade.type,
          trade_amount: trade.amount,
          trade_date: trade.date.toISOString(),
          trade_session: trade.session || null,
          tags: trade.tags || [],
          embedding: `[${embedding.join(',')}]`,
          embedded_content: content
        }, {
          onConflict: 'trade_id,calendar_id,user_id'
        });

      if (error) {
        addLog(`❌ Failed to store embedding for trade ${trade.id}: ${error.message}`);
        return false;
      }

      return true;
    } catch (error) {
      addLog(`❌ Error fixing embedding for trade ${trade.id}: ${error}`);
      return false;
    }
  };

  /**
   * Run the migration
   */
  const runMigration = async () => {
    if (!user || !calendar) {
      addLog('❌ User or calendar not available');
      return;
    }

    setIsRunning(true);
    setIsComplete(false);
    setLogs([]);
    setTestResults([]);

    try {
      addLog('🔧 Starting Vector Embeddings Migration');
      addLog(`User ID: ${user.uid}`);
      addLog(`Calendar ID: ${calendar.id}`);

      // Initialize embedding model
      addLog('🔄 Initializing embedding model...');
      await embeddingService.initialize();
      addLog('✅ Embedding model ready');

      // Get all trades
      const allTrades = await getAllTradesFromCalendar();
      updateStats({ 
        totalTrades: allTrades.length,
        processedTrades: 0,
        successCount: 0,
        errorCount: 0 
      });

      // Process trades in batches
      const batchSize = 5;
      for (let i = 0; i < allTrades.length; i += batchSize) {
        const batch = allTrades.slice(i, i + batchSize);
        addLog(`Processing trades ${i + 1}-${Math.min(i + batchSize, allTrades.length)} of ${allTrades.length}...`);

        const promises = batch.map(trade => fixTradeEmbedding(trade));
        const results = await Promise.allSettled(promises);

        let batchSuccess = 0;
        let batchErrors = 0;

        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value) {
            batchSuccess++;
          } else {
            batchErrors++;
          }
        });

        updateStats({
          processedTrades: i + batch.length,
          successCount: stats.successCount + batchSuccess,
          errorCount: stats.errorCount + batchErrors,
        });

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      addLog('✅ Migration completed!');
      addLog(`📊 Final Results:`);
      addLog(`  Total trades: ${stats.totalTrades}`);
      addLog(`  Successfully migrated: ${stats.successCount}`);
      addLog(`  Errors: ${stats.errorCount}`);

      // Test the migration with sample queries
      await testMigration();

      setIsComplete(true);
    } catch (error) {
      addLog(`❌ Migration failed: ${error}`);
    } finally {
      setIsRunning(false);
      updateStats({ currentYear: undefined, currentTrade: undefined });
    }
  };

  /**
   * Test the migration with sample queries
   */
  const testMigration = async () => {
    if (!user || !calendar) return;

    addLog('🧪 Testing migration with comprehensive search...');

    const testQueries = [
      { query: 'how many monday trades do i have?', expectedDay: 'Monday' },
      { query: 'monday trades', expectedDay: 'Monday' },
      { query: 'tuesday trades', expectedDay: 'Tuesday' },
      { query: 'weekday trades', expectedDay: null },
      { query: 'weekend trades', expectedDay: null }
    ];

    const results = [];

    for (const { query, expectedDay } of testQueries) {
      try {
        addLog(`Testing: "${query}"`);

        // Test with a very low threshold and high max results to get ALL matches
        const searchResults = await vectorSearchService.searchSimilarTrades(
          query,
          user.uid,
          calendar.id,
          {
            maxResults: 100, // Get up to 100 results to see all matches
            similarityThreshold: 0.1 // Very low threshold to catch all potential matches
          }
        );

        // If we're looking for a specific day, let's also count actual day matches
        let actualDayMatches = 0;
        if (expectedDay && searchResults.length > 0) {
          actualDayMatches = searchResults.filter(result =>
            result.embeddedContent?.toLowerCase().includes(`day ${expectedDay.toLowerCase()}`)
          ).length;
        }

        results.push({
          query,
          resultCount: searchResults.length,
          results: searchResults.slice(0, 5), // Show top 5 for display
          actualDayMatches,
          expectedDay
        });

        addLog(`  ✅ Found ${searchResults.length} total results`);
        if (expectedDay && actualDayMatches > 0) {
          addLog(`  📅 ${actualDayMatches} trades actually contain "day ${expectedDay.toLowerCase()}"`);
        }

        // Log top 5 similarity scores for debugging
        searchResults.slice(0, 5).forEach((result, index) => {
          addLog(`    ${index + 1}. Similarity: ${result.similarity?.toFixed(3)} - ${result.embeddedContent?.substring(0, 50)}...`);
        });

        if (searchResults.length > 5) {
          addLog(`    ... and ${searchResults.length - 5} more results`);
        }

      } catch (error) {
        addLog(`  ❌ Test failed: ${error}`);
        results.push({
          query,
          resultCount: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    setTestResults(results);
    addLog('🧪 Comprehensive testing completed');

    // Now let's also check the actual database for Monday trades
    await checkActualMondayTrades();
  };

  /**
   * Check how many Monday trades are actually in the database
   */
  const checkActualMondayTrades = async () => {
    if (!user || !calendar) return;

    addLog('🔍 Checking actual Monday trades in database...');

    try {
      // Get all embeddings and check their content
      const { data, error } = await supabaseAdmin
        .from('trade_embeddings')
        .select('trade_id, embedded_content, trade_date')
        .match({
          user_id: user.uid,
          calendar_id: calendar.id
        });

      if (error) {
        addLog(`❌ Database check failed: ${error.message}`);
        return;
      }

      if (!data) {
        addLog(`❌ No data returned from database`);
        return;
      }

      // Count trades by day of week
      const dayCount: { [key: string]: number } = {};
      const mondayTrades: any[] = [];

      data.forEach(row => {
        const date = new Date(row.trade_date);
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

        dayCount[dayOfWeek] = (dayCount[dayOfWeek] || 0) + 1;

        if (dayOfWeek === 'Monday') {
          mondayTrades.push(row);
        }
      });

      addLog(`✅ Total trades in database: ${data.length}`);
      addLog(`📊 Trades by day of week:`);
      Object.entries(dayCount).sort().forEach(([day, count]) => {
        addLog(`   ${day}: ${count} trades`);
      });

      addLog(`🎯 Actual Monday trades: ${mondayTrades.length}`);

      if (mondayTrades.length > 0) {
        addLog(`📝 Sample Monday trade content:`);
        mondayTrades.slice(0, 3).forEach((trade, index) => {
          addLog(`   ${index + 1}. ${trade.embedded_content.substring(0, 100)}...`);
        });
      }

    } catch (error) {
      addLog(`❌ Monday trades check failed: ${error}`);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      onClose();
    }
  };

  const progress = stats.totalTrades > 0 ? (stats.processedTrades / stats.totalTrades) * 100 : 0;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown={isRunning}
    >
      <DialogTitle>
        Vector Embeddings Migration
      </DialogTitle>
      
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          This tool fixes the embedding mismatch that prevents time-based queries from working.
          It will regenerate all trade embeddings using the correct transformer model.
        </Alert>

        {!isRunning && !isComplete && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click "Start Migration" to fix the vector embeddings. This process may take several minutes
            depending on the number of trades in your calendar.
          </Typography>
        )}

        {isRunning && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Migration Progress
            </Typography>
            
            <LinearProgress 
              variant="determinate" 
              value={progress} 
              sx={{ mb: 1 }}
            />
            
            <Typography variant="body2" color="text.secondary">
              {stats.processedTrades} / {stats.totalTrades} trades processed
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip 
                label={`Success: ${stats.successCount}`} 
                color="success" 
                size="small" 
              />
              <Chip 
                label={`Errors: ${stats.errorCount}`} 
                color="error" 
                size="small" 
              />
            </Box>

            {stats.currentYear && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Processing year: {stats.currentYear}
              </Typography>
            )}
          </Box>
        )}

        {testResults.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Test Results
            </Typography>
            <List dense>
              {testResults.map((result, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={result.query}
                    secondary={
                      result.error 
                        ? `Error: ${result.error}`
                        : `Found ${result.resultCount} results`
                    }
                  />
                  <Chip 
                    label={result.resultCount} 
                    color={result.resultCount > 0 ? 'success' : 'default'}
                    size="small"
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        )}

        {logs.length > 0 && (
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 2, 
              maxHeight: 300, 
              overflow: 'auto',
              backgroundColor: 'grey.50',
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}
          >
            {logs.map((log, index) => (
              <Typography 
                key={index} 
                variant="body2" 
                component="div"
                sx={{ whiteSpace: 'pre-wrap' }}
              >
                {log}
              </Typography>
            ))}
          </Paper>
        )}
      </DialogContent>

      <DialogActions>
        <Button 
          onClick={handleClose} 
          disabled={isRunning}
        >
          {isComplete ? 'Close' : 'Cancel'}
        </Button>
        
        {!isRunning && !isComplete && (
          <Button 
            onClick={runMigration}
            variant="contained"
            color="primary"
          >
            Start Migration
          </Button>
        )}

        {isComplete && (
          <>
            <Button
              onClick={checkDatabaseContent}
              variant="outlined"
              color="secondary"
              sx={{ mr: 1 }}
            >
              Check Database
            </Button>
            <Button
              onClick={testMigration}
              variant="outlined"
              color="primary"
            >
              Re-test
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default VectorMigrationDialog;
