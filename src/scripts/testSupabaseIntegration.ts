/**
 * End-to-End Supabase Integration Test
 * Tests the core functionality of migrated services
 */

import { supabase, testSupabaseConnection } from '../config/supabase';
import { repositoryService } from '../services/repository';
import { economicCalendarService } from '../services/economicCalendarService';
import { logger } from '../utils/logger';

interface TestResult {
  name: string;
  success: boolean;
  error?: string;
  details?: any;
}

class SupabaseIntegrationTester {
  private results: TestResult[] = [];

  private addResult(name: string, success: boolean, error?: string, details?: any) {
    this.results.push({ name, success, error, details });
    const status = success ? '✅' : '❌';
    console.log(`${status} ${name}${error ? `: ${error}` : ''}`);
  }

  /**
   * Test 1: Basic Supabase Connection
   */
  async testConnection(): Promise<void> {
    try {
      const connected = await testSupabaseConnection();
      this.addResult('Supabase Connection', connected, connected ? undefined : 'Connection failed');
    } catch (error) {
      this.addResult('Supabase Connection', false, (error as Error).message);
    }
  }

  /**
   * Test 2: Repository Service - Calendar Operations
   */
  async testRepositoryCalendarOperations(): Promise<void> {
    try {
      // Test getting calendars (should handle empty results gracefully)
      const calendars = await repositoryService.getCalendarsByUserId('test-user-id');

      this.addResult('Repository Calendar Retrieval', true, undefined, {
        calendarsFound: calendars.length
      });
    } catch (error) {
      this.addResult('Repository Calendar Retrieval', false, (error as Error).message);
    }
  }

  /**
   * Test 3: Economic Calendar Service - Supabase Queries
   */
  async testEconomicCalendarService(): Promise<void> {
    try {
      // Test fetching economic events
      const today = new Date().toISOString().split('T')[0];
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const events = await economicCalendarService.fetchEvents({
        start: today,
        end: nextWeek
      }, {
        currencies: ['USD']
      });

      this.addResult('Economic Calendar Service', true, undefined, {
        eventsRetrieved: events.length,
        sampleEvent: events[0] ? {
          id: events[0].id,
          event: events[0].event,
          currency: events[0].currency
        } : 'No events found'
      });
    } catch (error) {
      this.addResult('Economic Calendar Service', false, (error as Error).message);
    }
  }

  /**
   * Test 4: Supabase Auth Integration
   */
  async testAuthIntegration(): Promise<void> {
    try {
      // Test getting current user session
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error && error.message !== 'Auth session missing!') {
        this.addResult('Supabase Auth Integration', false, error.message);
      } else {
        this.addResult('Supabase Auth Integration', true, undefined, {
          userLoggedIn: !!user,
          userId: user?.id || 'No user logged in'
        });
      }
    } catch (error) {
      this.addResult('Supabase Auth Integration', false, (error as Error).message);
    }
  }

  /**
   * Test 5: Error Handling
   */
  async testErrorHandling(): Promise<void> {
    try {
      // Test repository error handling with invalid data
      const invalidResult = await repositoryService.getCalendar('invalid-calendar-id');

      // Should gracefully handle not found (returns null)
      if (invalidResult === null) {
        this.addResult('Error Handling', true, undefined, {
          errorHandled: true,
          errorMessage: 'Calendar not found (as expected)'
        });
      } else {
        this.addResult('Error Handling', false, 'Expected null for invalid ID but got a result');
      }
    } catch (error) {
      this.addResult('Error Handling', false, (error as Error).message);
    }
  }

  /**
   * Test 6: Database Schema Access
   */
  async testDatabaseSchema(): Promise<void> {
    try {
      // Test if we can access the main tables
      const tables = ['calendars', 'trades', 'economic_events'];
      const tableResults: any = {};

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

          tableResults[table] = {
            accessible: !error,
            error: error?.message
          };
        } catch (err) {
          tableResults[table] = {
            accessible: false,
            error: (err as Error).message
          };
        }
      }

      const allTablesAccessible = Object.values(tableResults).every((result: any) => result.accessible);

      this.addResult('Database Schema Access', allTablesAccessible, undefined, tableResults);
    } catch (error) {
      this.addResult('Database Schema Access', false, (error as Error).message);
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Supabase Integration Tests...\n');

    await this.testConnection();
    await this.testAuthIntegration();
    await this.testDatabaseSchema();
    await this.testRepositoryCalendarOperations();
    await this.testEconomicCalendarService();
    await this.testErrorHandling();

    console.log('\n📊 Test Summary:');
    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;

    console.log(`Passed: ${passed}/${total}`);
    console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

    if (passed === total) {
      console.log('🎉 All tests passed! Supabase integration is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Review the errors above.');
    }

    return this.results;
  }
}

// Export for potential use in other scripts
export default SupabaseIntegrationTester;

// Run tests if this script is executed directly
if (require.main === module) {
  const tester = new SupabaseIntegrationTester();
  tester.runAllTests().catch(console.error);
}