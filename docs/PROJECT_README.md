# Simple Trade Tracker

A comprehensive React-based trading journal application that allows traders to track their trades, analyze performance, and manage trading calendars. The project has been fully migrated from Firebase to Supabase with enhanced error handling and modern architecture patterns.

## 🚀 Features

### Core Trading Features
- **Trade Management**: Create, edit, and delete trades with comprehensive details
- **Calendar Organization**: Organize trades by calendar with year-based subcollections
- **Performance Analytics**: Advanced charts and statistics for trade analysis
- **Tag System**: Hierarchical tagging with required tag groups and validation
- **Risk Management**: Dynamic risk adjustment based on performance
- **Image Support**: Upload and manage trade screenshots with optimization

### Advanced Features
- **AI-Powered Search**: Vector-based semantic search for trades and analysis
- **Economic Calendar**: Real-time economic events with impact filtering
- **Share Links**: Generate secure share links for trades and calendars
- **Real-time Updates**: Live data synchronization across all clients
- **Rich Text Editor**: Custom Draft.js implementation for trade notes
- **Responsive Design**: Mobile-first approach with Material-UI components

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Material-UI v7
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth with Google OAuth
- **Storage**: Supabase Storage for file management
- **Real-time**: Supabase postgres_changes subscriptions
- **AI/ML**: Vector search with pgvector extension

### Service Layer Architecture

The application features a comprehensive service layer with enhanced error handling:

```
src/services/
├── utils/
│   ├── supabaseErrorHandler.ts          # Core error handling system
│   └── supabaseServiceErrorHandler.ts   # Service operation utilities
├── repository/
│   ├── repositories/
│   │   ├── BaseRepository.ts             # Enhanced base repository
│   │   ├── CalendarRepository.ts         # Calendar data operations
│   │   └── TradeRepository.ts            # Trade data operations
│   └── RepositoryService.ts              # Service layer integration
├── calendarService.ts                    # Calendar business logic
├── economicCalendarService.ts            # Economic events management
├── economicEventWatcher.ts               # Real-time event processing
└── sharingService.ts                     # Share link generation
```

## 📚 Documentation

### Service Layer Documentation
- **[Service Layer Documentation](./SERVICE_LAYER_DOCUMENTATION.md)** - Comprehensive guide to the service architecture
- **[Error Handling Guide](./ERROR_HANDLING_GUIDE.md)** - Detailed error handling patterns and best practices
- **[Firebase to Supabase Migration](./FIREBASE_TO_SUPABASE_SERVICE_MIGRATION.md)** - Migration patterns and examples

### Migration Documentation
- **[Migration Guide](./MIGRATION_GUIDE.md)** - Overall migration strategy and timeline
- **[Storage Migration Guide](./STORAGE_MIGRATION_GUIDE.md)** - File storage migration details
- **[Dual Write Integration Guide](./DUAL_WRITE_INTEGRATION_GUIDE.md)** - Legacy dual-write system

### Feature Documentation
- **[AI Database Queries](./AI_DATABASE_QUERIES.md)** - AI-powered search and analysis
- **[Sharing Feature](./SHARING_FEATURE.md)** - Share link implementation
- **[Supabase Vector Setup](./SUPABASE_VECTOR_SETUP.md)** - Vector search configuration

## 🛠️ Development

### Prerequisites
- Node.js 18+ and npm
- Supabase CLI
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd simple-trade-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file with your Supabase configuration:
   ```bash
   REACT_APP_SUPABASE_URL=your-supabase-url
   REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Database Setup**
   ```bash
   # Start local Supabase
   supabase start
   
   # Run migrations
   supabase db reset
   ```

5. **Start Development Server**
   ```bash
   npm start
   ```

### Common Commands

```bash
# Development
npm start                    # Start React development server
npm run build               # Build production application
npm test                    # Run Jest tests

# Database
npm run migrate-events      # Run trade event migration script
npm run setup-vector-index  # Set up vector search index

# Deployment
npm run deploy              # Deploy to GitHub Pages
```

## 🔧 Service Layer Usage

### Error Handling

The application uses a comprehensive error handling system:

```typescript
import { executeSupabaseQuery } from '../services/supabaseServiceErrorHandler';

// Database operations with automatic retry
const result = await executeSupabaseQuery(
  supabase.from('trades').select('*').eq('user_id', userId),
  'Fetch User Trades',
  {
    context: 'Loading user dashboard',
    retryAttempts: 2
  }
);

if (!result.success) {
  console.error('Operation failed:', result.error?.userMessage);
  return;
}

const trades = result.data;
```

### Repository Pattern

All data access uses the repository pattern:

```typescript
import { RepositoryService } from '../services/repository/RepositoryService';

const repositoryService = new RepositoryService();

// Create trade with enhanced error handling
const result = await repositoryService.createTrade({
  name: 'EURUSD Long',
  calendar_id: 'cal-123',
  user_id: 'user-456'
});

if (!result.success) {
  throw new Error(result.error?.userMessage || 'Failed to create trade');
}

const trade = result.data;
```

### Edge Functions

Supabase Edge Functions are used for server-side operations:

```typescript
import { executeSupabaseFunction } from '../services/supabaseServiceErrorHandler';

// Call Edge Function with retry logic
const result = await executeSupabaseFunction(
  'update-tag',
  { calendarId, oldTag, newTag },
  supabase,
  { retryAttempts: 2 }
);
```

## 🧪 Testing

### Error Handling Tests

The application includes comprehensive error handling tests:

```bash
# Run error handling tests
npm test -- --testPathPattern=supabaseErrorHandler

# Run service layer tests
npm test -- --testPathPattern=services

# Run all tests with coverage
npm test -- --coverage
```

### Manual Testing Scenarios

1. **Network Failures**: Test with network disconnection
2. **Rate Limiting**: Test with rapid API calls
3. **Permission Errors**: Test with different user roles
4. **Data Validation**: Test with invalid data inputs
5. **Concurrent Operations**: Test race conditions

## 🚀 Deployment

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy to hosting platform**
   ```bash
   npm run deploy  # GitHub Pages
   # or deploy build/ directory to your preferred platform
   ```

3. **Configure Supabase**
   - Set up production database
   - Configure RLS policies
   - Deploy Edge Functions
   - Set up authentication providers

### Environment Variables

Production environment requires:
- `REACT_APP_SUPABASE_URL` - Supabase project URL
- `REACT_APP_SUPABASE_ANON_KEY` - Supabase anonymous key

## 📊 Monitoring

### Error Monitoring

The application logs structured errors for monitoring:

```typescript
{
  level: 'error',
  category: 'database',
  severity: 'high',
  code: '23505',
  message: 'duplicate key value violates unique constraint',
  userMessage: 'This item already exists',
  context: 'Creating trade',
  timestamp: '2024-01-15T10:30:00Z',
  userId: 'user-123',
  retryAttempt: 2
}
```

### Key Metrics

Monitor these metrics in production:
- **Error Rate**: Percentage of operations that fail
- **Retry Success Rate**: Percentage of retries that succeed
- **Response Times**: Operation duration including retries
- **User Impact**: Errors affecting user experience

## 🤝 Contributing

### Development Guidelines

1. **Follow TypeScript strict mode** for type safety
2. **Use repository pattern** for all database operations
3. **Implement proper error handling** with service utilities
4. **Write tests** for error scenarios
5. **Document new features** with JSDoc comments

### Code Style

- Use service layer for business logic
- Keep repositories focused on data access
- Implement error boundaries in React components
- Use structured logging for debugging
- Test error scenarios thoroughly

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

### Troubleshooting

For common issues, see:
- [Error Handling Guide](./docs/ERROR_HANDLING_GUIDE.md)
- [Service Layer Documentation](./docs/SERVICE_LAYER_DOCUMENTATION.md)
- [Migration Documentation](./docs/MIGRATION_GUIDE.md)

### Getting Help

1. Check the documentation in the `docs/` directory
2. Review error logs for structured error information
3. Test with different user scenarios
4. Check Supabase service status and quotas

---

## 📈 Migration Status

The project has been successfully migrated from Firebase to Supabase:

- ✅ **Authentication**: Supabase Auth with Google OAuth
- ✅ **Database**: PostgreSQL with enhanced error handling
- ✅ **Storage**: Supabase Storage with progress tracking
- ✅ **Functions**: Edge Functions replacing Cloud Functions
- ✅ **Real-time**: postgres_changes subscriptions
- ✅ **Error Handling**: Comprehensive error management system
- ✅ **Type Safety**: Full TypeScript support throughout

The migration provides improved performance, better error handling, and enhanced developer experience while maintaining all existing functionality.
