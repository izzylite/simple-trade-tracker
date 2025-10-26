# Supabase Vector Database Setup Guide

This guide walks you through setting up Supabase with pgvector for enhanced AI chat functionality in your trading application.

## 🎯 What This Adds

- **Semantic Search**: Find trades by meaning, not just keywords
- **Better AI Context**: AI gets only the most relevant trades for each query
- **Faster Responses**: Smaller, focused context = faster AI processing
- **Cost Effective**: Reduced token usage with Firebase AI

## 📋 Prerequisites

- Supabase account (free tier is sufficient)
- Your existing Firebase trading app

## 🚀 Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/sign in
2. Click "New Project"
3. Choose your organization
4. Project settings:
   - **Name**: `simple-trade-tracker-vectors`
   - **Database Password**: Generate and save a strong password
   - **Region**: Choose closest to your users
   - **Pricing Plan**: **Free tier** (500MB - perfect for your use case)
5. Wait for project creation (~2 minutes)

### 2. Configure Environment Variables

Update your `.env` file with your Supabase credentials:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...your-anon-key
```

**To find these values:**
1. Go to your Supabase project dashboard
2. Navigate to **Settings → API**
3. Copy the **Project URL** and **Anon/Public Key**

### 3. Set Up Database Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy and paste the contents of `src/database/supabase-schema.sql`
3. Click **Run** to execute the SQL

This creates:
- `trade_embeddings` table for storing vector embeddings
- `embedding_metadata` table for tracking sync status
- Vector similarity search functions
- Proper indexes for performance
- Row Level Security (RLS) policies

### 4. Test the Setup

The dependencies are already installed:
- `@supabase/supabase-js` - Supabase client
- `@xenova/transformers` - Local embedding generation

## 🔧 How It Works

### Architecture

```
User Query → Generate Embedding → Vector Search → Relevant Trades → Firebase AI → Response
```

### Key Components

1. **Embedding Service** (`src/services/embeddingService.ts`)
   - Uses `all-MiniLM-L6-v2` model (384 dimensions)
   - Runs locally in browser (no API costs)
   - Converts trade data to searchable text

2. **Vector Search Service** (`src/services/vectorSearchService.ts`)
   - Handles Supabase pgvector operations
   - Semantic similarity search
   - Batch operations for performance

3. **Enhanced AI Chat** (`src/services/firebaseAIChatService.ts`)
   - New `sendMessageWithVectorSearch()` method
   - Finds relevant trades before sending to AI
   - Falls back to regular context if needed

4. **Migration Utility** (`src/utils/vectorMigrationUtil.ts`)
   - Converts existing trades to embeddings
   - Batch processing with progress tracking
   - Status management and cleanup

## 🎮 Usage

### Initial Setup

1. **Migrate Existing Trades**:
   ```typescript
   import { vectorMigrationUtil } from './utils/vectorMigrationUtil';
   
   await vectorMigrationUtil.migrateTradesToVectors(
     trades, 
     calendar, 
     userId
   );
   ```

2. **Use Enhanced AI Chat**:
   ```typescript
   import { firebaseAIChatService } from './services/firebaseAIChatService';
   
   const result = await firebaseAIChatService.sendMessageWithVectorSearch(
     "Show me my best EUR/USD trades",
     trades,
     calendar,
     userId
   );
   ```

### Vector Migration Dialog

Use the `VectorMigrationDialog` component to:
- Check connection status
- Migrate trades to embeddings
- Test vector search functionality
- Clear embeddings if needed

```typescript
<VectorMigrationDialog
  open={dialogOpen}
  onClose={() => setDialogOpen(false)}
  trades={trades}
  calendar={calendar}
  userId={userId}
/>
```

## 📊 Benefits

### Before (Current System)
- Sends all 181 trades to AI
- Large context = slower responses
- Higher token costs
- Keyword-based filtering only

### After (With Vector Search)
- Sends only 10-15 most relevant trades
- Smaller context = faster responses
- Lower token costs
- Semantic understanding

### Example Queries That Work Better

- "Show me trades similar to my best EUR/USD win"
- "Find trades where I took partials during high impact news"
- "What patterns do my losing trades have in common?"
- "Show me trades from volatile market conditions"

## 🔧 Configuration

### Vector Search Settings

```typescript
// In src/config/supabase.ts
export const VECTOR_CONFIG = {
  EMBEDDING_DIMENSION: 384,
  SIMILARITY_THRESHOLD: 0.7,
  MAX_RESULTS: 20,
};
```

### Embedding Model

- **Model**: `all-MiniLM-L6-v2`
- **Dimensions**: 384
- **Language**: English
- **Performance**: Fast, runs in browser
- **Cost**: Free (no API calls)

## 🚨 Troubleshooting

### Common Issues

1. **"Supabase connection failed"**
   - Check environment variables
   - Verify project URL and API key
   - Ensure project is not paused

2. **"pgvector extension not found"**
   - Run the schema SQL in Supabase SQL Editor
   - Ensure `CREATE EXTENSION vector;` executed successfully

3. **"Embedding model loading slowly"**
   - First load downloads ~50MB model
   - Subsequent loads are instant
   - Consider showing loading indicator

4. **"No similar trades found"**
   - Lower similarity threshold (0.5-0.6)
   - Check if embeddings exist for trades
   - Verify migration completed successfully

### Performance Tips

1. **Batch Size**: Use 5-10 trades per batch for migration
2. **Similarity Threshold**: Start with 0.6, adjust based on results
3. **Max Results**: 15-20 trades provide good context without overwhelming AI
4. **Model Caching**: Embedding model loads once per session

## 🔄 Migration Strategy

### For Existing Users

1. **Gradual Rollout**: Enable for power users first
2. **Fallback**: Always fall back to regular AI chat if vector search fails
3. **Background Migration**: Run migration during low-usage periods
4. **Progress Tracking**: Show migration progress to users

### Data Management

- **Storage**: ~1KB per trade embedding
- **Free Tier**: 500MB = ~500K trades (more than sufficient)
- **Sync**: Re-run migration when trades are added/updated
- **Cleanup**: Clear embeddings when calendars are deleted

## 🎉 Next Steps

1. **Complete Supabase setup** following steps 1-3
2. **Test the connection** using the migration dialog
3. **Migrate your trades** to create embeddings
4. **Try enhanced AI chat** with semantic search
5. **Monitor performance** and adjust settings as needed

The vector search enhancement will significantly improve your AI chat experience by providing more relevant and focused responses!
