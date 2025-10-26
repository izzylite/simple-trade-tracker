# Firebase Cloud Functions Analysis

## Function Logic and Dependencies Analysis

### 1. onTradeChangedV2 (Firestore Trigger)

#### Logic Flow
1. **Image Cleanup**: Calls `cleanupRemovedImagesHelper()` to delete unused images
2. **Year Changes**: Calls `handleTradeYearChanges()` to move trades between year documents
3. **Tag Updates**: Updates calendar tags when trade tags change

#### Dependencies Analysis
- **Firebase Admin SDK**: Firestore operations, Storage operations
- **Complex Image Logic**: Handles duplicated calendars and shared images
- **Transaction Support**: Ensures data consistency during year changes
- **Tag Synchronization**: Maintains calendar-level tag consistency

#### Migration Challenges
- **Firestore Triggers → Database Webhooks**: Need to implement database triggers in PostgreSQL
- **Storage Integration**: Replace Firebase Storage with Supabase Storage
- **Transaction Complexity**: Adapt Firestore transactions to PostgreSQL transactions

### 2. cleanupDeletedCalendarV2 (Firestore Trigger)

#### Logic Flow
1. **Data Validation**: Checks calendar data and user ID
2. **Subcollection Cleanup**: Recursively deletes all year documents and trades
3. **Image Cleanup**: Removes all associated images from storage
4. **Batch Processing**: Handles large datasets with proper error handling

#### Dependencies Analysis
- **Recursive Deletion**: Complex logic for nested subcollections
- **Storage Operations**: Bulk file deletion from Firebase Storage
- **Error Handling**: Comprehensive logging and error recovery

#### Migration Challenges
- **Subcollection Model**: PostgreSQL doesn't have subcollections - need to redesign data model
- **Cascade Deletes**: Implement proper foreign key constraints and cascade deletes
- **Storage Cleanup**: Adapt to Supabase Storage API

### 3. updateTagV2 (Callable Function)

#### Logic Flow
1. **Authentication**: Verifies user and App Check
2. **Group Name Changes**: Handles hierarchical tag updates (Category:Tag format)
3. **Batch Updates**: Processes all trades in calendar with transactions
4. **Calendar Sync**: Updates calendar-level tag list

#### Dependencies Analysis
- **App Check**: Firebase-specific security feature
- **Complex Tag Logic**: Handles group name changes across all related tags
- **Transaction Support**: Ensures atomicity across multiple documents
- **CORS Configuration**: Web client compatibility

#### Migration Challenges
- **App Check Replacement**: Need alternative security verification
- **Transaction Scope**: Adapt to PostgreSQL transaction model
- **Tag Hierarchy**: Maintain tag group functionality in new schema

### 4. Scheduled Functions

#### cleanupExpiredCalendarsV2
- **Cron Schedule**: `0 2 * * *` (daily at 2 AM)
- **Query Logic**: Firestore compound queries with date filtering
- **Batch Processing**: Handles multiple calendar deletions

#### autoRefreshEconomicCalendarV2
- **Cron Schedule**: `*/30 * * * *` (every 30 minutes)
- **External API**: MyFXBook integration with HTML parsing
- **Data Processing**: Currency filtering and event normalization
- **Storage**: Firestore document creation with deduplication

#### Migration Challenges
- **Cron Jobs**: Replace Cloud Scheduler with Supabase Cron or external scheduler
- **API Integration**: Maintain MyFXBook API calls in Deno runtime
- **HTML Parsing**: Replace cheerio with Deno-compatible HTML parser

### 5. Economic Calendar Functions

#### processHtmlEconomicEvents & refreshEconomicCalendar
- **HTML Processing**: Uses cheerio for parsing MyFXBook HTML
- **Data Transformation**: Converts HTML to structured event objects
- **Deduplication**: Prevents duplicate events using hash-based IDs
- **Currency Filtering**: Supports major currency pairs

#### Migration Challenges
- **Cheerio Dependency**: Replace with Deno-compatible HTML parser (e.g., deno-dom)
- **Crypto Module**: Use Deno's built-in crypto API
- **HTTP Requests**: Replace with Deno's fetch API

### 6. Sharing Functions

#### generateTradeShareLinkV2 & generateCalendarShareLinkV2
- **Link Generation**: Creates direct shareable URLs
- **Document Creation**: Stores share metadata in Firestore
- **Security**: Validates ownership and calendar access

#### getSharedTradeV2 & getSharedCalendarV2
- **Public Access**: Allows unauthenticated access to shared content
- **View Tracking**: Increments view counters
- **Data Retrieval**: Fetches trade/calendar data for display

#### deactivateSharedTradeV2 & deactivateSharedCalendarV2
- **Cleanup**: Removes share documents completely
- **Authorization**: Ensures only owners can deactivate shares

#### Migration Challenges
- **Public Access**: Implement RLS policies for public sharing
- **URL Structure**: Maintain compatibility with existing share links
- **View Tracking**: Implement atomic counter updates in PostgreSQL

## Key Migration Considerations

### 1. Runtime Environment
- **Node.js → Deno**: Different module system and APIs
- **npm packages → Deno modules**: Replace Node.js dependencies
- **TypeScript**: Both support TypeScript, but with different configurations

### 2. Database Operations
- **Firestore → PostgreSQL**: Document model to relational model
- **Subcollections → Foreign Keys**: Redesign data relationships
- **Transactions**: Adapt to PostgreSQL transaction semantics

### 3. Storage Operations
- **Firebase Storage → Supabase Storage**: Different API and authentication
- **File Paths**: Maintain compatibility with existing file structure
- **Access Control**: Implement RLS policies for storage

### 4. Authentication & Security
- **Firebase Auth → Supabase Auth**: JWT token validation
- **App Check → Custom Security**: Implement alternative verification
- **CORS**: Configure for Supabase Edge Functions

### 5. Scheduling & Triggers
- **Cloud Scheduler → Supabase Cron**: Migrate scheduled functions
- **Firestore Triggers → Database Webhooks**: Implement database triggers
- **Event Handling**: Adapt to Supabase's event system

### 6. External Integrations
- **MyFXBook API**: Maintain existing integration
- **HTML Parsing**: Replace cheerio with Deno-compatible parser
- **HTTP Clients**: Use Deno's built-in fetch API

## Next Steps
1. Map each function to Supabase Edge Function equivalent
2. Design PostgreSQL schema to replace Firestore subcollections
3. Set up Supabase Edge Functions development environment
4. Create migration plan for each function category
