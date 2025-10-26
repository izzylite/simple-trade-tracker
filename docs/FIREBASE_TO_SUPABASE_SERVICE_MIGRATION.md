# Firebase to Supabase Service Migration Patterns

## Overview

This document provides detailed patterns and examples for migrating services from Firebase to Supabase, including error handling, retry logic, and best practices learned during the Simple Trade Tracker migration.

## Migration Patterns

### 1. Database Operations

#### Firebase Pattern (Before)
```typescript
// Firebase Firestore
import { firestore } from '../firebase/config';

const createTrade = async (trade: Trade) => {
  try {
    const docRef = await firestore.collection('trades').add({
      ...trade,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating trade:', error);
    throw new Error('Failed to create trade');
  }
};
```

#### Supabase Pattern (After)
```typescript
// Supabase with enhanced error handling
import { executeSupabaseQuery } from '../services/supabaseServiceErrorHandler';
import { supabase } from '../config/supabase';

const createTrade = async (trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>) => {
  const result = await executeSupabaseQuery(
    supabase.from('trades').insert(trade).select().single(),
    'Create Trade',
    {
      context: `Creating trade for calendar ${trade.calendar_id}`,
      retryAttempts: 2
    }
  );

  if (!result.success) {
    throw new Error(result.error?.userMessage || 'Failed to create trade');
  }

  return result.data.id;
};
```

### 2. Real-time Subscriptions

#### Firebase Pattern (Before)
```typescript
// Firebase real-time listener
import { firestore } from '../firebase/config';

const subscribeToTrades = (calendarId: string, callback: (trades: Trade[]) => void) => {
  return firestore
    .collection('trades')
    .where('calendarId', '==', calendarId)
    .onSnapshot(
      (snapshot) => {
        const trades = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Trade[];
        callback(trades);
      },
      (error) => {
        console.error('Subscription error:', error);
      }
    );
};
```

#### Supabase Pattern (After)
```typescript
// Supabase real-time subscription with error handling
import { supabase } from '../config/supabase';
import { parseSupabaseError } from '../utils/supabaseErrorHandler';

const subscribeToTrades = (
  calendarId: string, 
  callback: (trades: Trade[]) => void,
  errorCallback?: (error: SupabaseError) => void
) => {
  const subscription = supabase
    .channel(`trades-${calendarId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'trades',
        filter: `calendar_id=eq.${calendarId}`
      },
      async (payload) => {
        try {
          // Fetch updated data
          const result = await executeSupabaseQuery(
            supabase.from('trades').select('*').eq('calendar_id', calendarId),
            'Fetch Updated Trades',
            { retryAttempts: 2 }
          );

          if (result.success) {
            callback(result.data);
          } else if (errorCallback) {
            errorCallback(result.error!);
          }
        } catch (error) {
          const parsedError = parseSupabaseError(error, 'Real-time subscription');
          if (errorCallback) {
            errorCallback(parsedError);
          }
        }
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
};
```

### 3. Cloud Functions to Edge Functions

#### Firebase Pattern (Before)
```typescript
// Firebase Cloud Function call
import { functions } from '../firebase/config';

const updateTradeTag = async (calendarId: string, oldTag: string, newTag: string) => {
  try {
    const updateTag = functions.httpsCallable('updateTag');
    const result = await updateTag({ calendarId, oldTag, newTag });
    return result.data;
  } catch (error) {
    console.error('Function call failed:', error);
    throw new Error('Failed to update tag');
  }
};
```

#### Supabase Pattern (After)
```typescript
// Supabase Edge Function call with enhanced error handling
import { executeSupabaseFunction } from '../services/supabaseServiceErrorHandler';
import { supabase } from '../config/supabase';

const updateTradeTag = async (calendarId: string, oldTag: string, newTag: string) => {
  const result = await executeSupabaseFunction(
    'update-tag',
    { calendarId, oldTag, newTag },
    supabase,
    {
      context: `Updating tag from "${oldTag}" to "${newTag}" in calendar ${calendarId}`,
      retryAttempts: 2
    }
  );

  if (!result.success) {
    throw new Error(result.error?.userMessage || 'Failed to update tag');
  }

  return {
    success: true,
    tradesUpdated: result.data?.tradesUpdated || 0
  };
};
```

### 4. Authentication

#### Firebase Pattern (Before)
```typescript
// Firebase Auth
import { auth } from '../firebase/config';

const signInWithGoogle = async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    return result.user;
  } catch (error) {
    console.error('Sign in failed:', error);
    throw new Error('Authentication failed');
  }
};
```

#### Supabase Pattern (After)
```typescript
// Supabase Auth with enhanced error handling
import { executeSupabaseAuthOperation } from '../services/supabaseServiceErrorHandler';
import { supabase } from '../config/supabase';

const signInWithGoogle = async () => {
  const result = await executeSupabaseAuthOperation(
    () => supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    }),
    'Google Sign In',
    {
      context: 'User authentication with Google OAuth',
      retryAttempts: 1
    }
  );

  if (!result.success) {
    throw new Error(result.error?.userMessage || 'Authentication failed');
  }

  return result.data;
};
```

### 5. Storage Operations

#### Firebase Pattern (Before)
```typescript
// Firebase Storage
import { storage } from '../firebase/config';

const uploadTradeImage = async (file: File, tradeId: string) => {
  try {
    const storageRef = storage.ref(`trade-images/${tradeId}/${file.name}`);
    const snapshot = await storageRef.put(file);
    const downloadURL = await snapshot.ref.getDownloadURL();
    return downloadURL;
  } catch (error) {
    console.error('Upload failed:', error);
    throw new Error('Failed to upload image');
  }
};
```

#### Supabase Pattern (After)
```typescript
// Supabase Storage with enhanced error handling and progress tracking
import { executeSupabaseStorageOperation } from '../services/supabaseServiceErrorHandler';
import { supabase } from '../config/supabase';

const uploadTradeImage = async (
  file: File, 
  tradeId: string,
  onProgress?: (progress: number) => void
) => {
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `users/${userId}/trade-images/${fileName}`;

  const result = await executeSupabaseStorageOperation(
    () => supabase.storage.from('trade-images').upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    }),
    'Upload Trade Image',
    {
      context: `Uploading image for trade ${tradeId}`,
      retryAttempts: 1,
      onProgress
    }
  );

  if (!result.success) {
    throw new Error(result.error?.userMessage || 'Failed to upload image');
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('trade-images')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
};
```

## Repository Pattern Migration

### Firebase Service Pattern (Before)
```typescript
// Direct Firebase operations in service
class TradeService {
  async createTrade(trade: Trade) {
    try {
      const docRef = await firestore.collection('trades').add(trade);
      return docRef.id;
    } catch (error) {
      throw new Error('Failed to create trade');
    }
  }

  async updateTrade(id: string, updates: Partial<Trade>) {
    try {
      await firestore.collection('trades').doc(id).update(updates);
      return true;
    } catch (error) {
      throw new Error('Failed to update trade');
    }
  }
}
```

### Supabase Repository Pattern (After)
```typescript
// Repository layer with enhanced error handling
class TradeRepository extends BaseRepository<Trade> {
  constructor() {
    super('trades');
  }

  async create(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>): Promise<RepositoryResult<Trade>> {
    return this.withRetryAndErrorHandling(
      async () => {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .insert(trade)
          .select()
          .single();

        if (error) throw error;
        return data as Trade;
      },
      'create',
      `Creating trade for calendar ${trade.calendar_id}`
    );
  }

  async update(id: string, updates: Partial<Trade>): Promise<RepositoryResult<Trade>> {
    return this.withRetryAndErrorHandling(
      async () => {
        const { data, error } = await this.supabase
          .from(this.tableName)
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return data as Trade;
      },
      'update',
      `Updating trade ${id}`
    );
  }
}

// Service layer using repository
class TradeService {
  constructor(private tradeRepo: TradeRepository) {}

  async createTrade(trade: Omit<Trade, 'id' | 'created_at' | 'updated_at'>) {
    const result = await this.tradeRepo.create(trade);
    
    if (!result.success) {
      throw new Error(result.error?.userMessage || 'Failed to create trade');
    }

    return result.data;
  }
}
```

## Error Handling Migration

### Firebase Error Handling (Before)
```typescript
// Basic try-catch with generic errors
try {
  const result = await firestore.collection('trades').add(trade);
  return result;
} catch (error) {
  console.error('Error:', error.message);
  throw new Error('Operation failed');
}
```

### Supabase Error Handling (After)
```typescript
// Structured error handling with categorization and retry
const result = await executeSupabaseQuery(
  supabase.from('trades').insert(trade),
  'Create Trade',
  { retryAttempts: 2 }
);

if (!result.success) {
  const error = result.error!;
  
  // Log structured error
  logger.error('Trade creation failed', {
    category: error.category,
    severity: error.severity,
    code: error.code,
    context: error.context,
    retryable: error.retryable
  });

  // Handle specific error types
  switch (error.category) {
    case SupabaseErrorCategory.VALIDATION:
      showValidationError(error.userMessage);
      break;
    case SupabaseErrorCategory.PERMISSION:
      redirectToLogin();
      break;
    case SupabaseErrorCategory.NETWORK:
      showRetryOption();
      break;
    default:
      showGenericError(error.userMessage);
  }

  throw new Error(error.userMessage);
}
```

## Migration Checklist

### Pre-Migration
- [ ] Audit existing Firebase services
- [ ] Identify error handling patterns
- [ ] Plan data migration strategy
- [ ] Set up Supabase project and configuration

### During Migration
- [ ] Implement repository layer
- [ ] Add enhanced error handling
- [ ] Migrate authentication
- [ ] Update real-time subscriptions
- [ ] Migrate storage operations
- [ ] Replace Cloud Functions with Edge Functions

### Post-Migration
- [ ] Test error scenarios
- [ ] Monitor error rates and patterns
- [ ] Optimize retry strategies
- [ ] Update documentation
- [ ] Train team on new patterns

## Best Practices

### Error Handling
1. **Use structured error types** instead of generic Error objects
2. **Implement appropriate retry strategies** for different error categories
3. **Provide user-friendly error messages** while logging technical details
4. **Handle partial failures** in batch operations gracefully
5. **Monitor error patterns** and adjust strategies accordingly

### Repository Pattern
1. **Separate data access from business logic** using repository layer
2. **Use consistent interfaces** across all repositories
3. **Implement proper error handling** at the repository level
4. **Provide type safety** with TypeScript generics
5. **Support batch operations** for performance optimization

### Service Layer
1. **Keep services focused** on business logic
2. **Use dependency injection** for testability
3. **Implement proper logging** for debugging
4. **Handle edge cases** gracefully
5. **Provide clear APIs** for consumers

### Testing
1. **Test error scenarios** thoroughly
2. **Mock external dependencies** for unit tests
3. **Use integration tests** for end-to-end flows
4. **Test retry logic** with simulated failures
5. **Validate error messages** and user experience

## Common Pitfalls

### Migration Issues
1. **Inconsistent error handling** across services
2. **Missing retry logic** for transient errors
3. **Poor error messages** that confuse users
4. **Inadequate logging** for debugging
5. **Incomplete test coverage** for error scenarios

### Performance Issues
1. **Excessive retry attempts** causing delays
2. **Blocking operations** during retries
3. **Missing connection pooling** for database operations
4. **Inefficient batch operations** causing timeouts
5. **Poor caching strategies** increasing error rates

### Security Issues
1. **Exposing system details** in error messages
2. **Missing permission checks** in repositories
3. **Inadequate RLS policies** for data access
4. **Poor authentication error handling** revealing user information
5. **Missing audit logging** for security events

---

## Migration Timeline

### Phase 1: Foundation (Week 1-2)
- Set up Supabase project
- Implement error handling system
- Create repository base classes
- Migrate authentication

### Phase 2: Core Services (Week 3-4)
- Migrate database operations
- Update real-time subscriptions
- Replace Cloud Functions
- Implement storage migration

### Phase 3: Testing & Optimization (Week 5-6)
- Comprehensive testing
- Performance optimization
- Error handling refinement
- Documentation updates

### Phase 4: Deployment (Week 7-8)
- Production deployment
- Monitoring setup
- User communication
- Firebase cleanup

For detailed implementation examples, see the service layer documentation and individual service files.
