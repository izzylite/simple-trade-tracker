# Vector Search Setup for AI Chat

This guide explains how to set up and use the new vector search optimization for your AI chat feature.

## Overview

The vector search optimization reduces context token usage by:
1. Storing trade embeddings in Firestore
2. Using semantic search to find only relevant trades for each query
3. Sending a smaller, more focused dataset to the AI instead of all trades

## Benefits

- **Reduced Token Usage**: Only sends 10-20 most relevant trades instead of all trades
- **Better Performance**: Faster AI responses due to smaller context
- **Improved Relevance**: AI gets more focused data related to the user's question
- **Cost Savings**: Lower token consumption = lower AI API costs

## Setup Steps

### 1. Enable Firestore Vector Search

First, you need to create a vector index for the trade embeddings collection:

```bash
# Install/update Google Cloud CLI
gcloud components update

# Create vector index for trade embeddings
gcloud firestore indexes composite create \
  --collection-group=trade-embeddings \
  --query-scope=COLLECTION \
  --field-config field-path=calendarId,order=ASCENDING \
  --field-config field-path=embedding,vector-config='{"dimension":"768", "flat": "{}"}' \
  --database=(default)
```

### 2. Initialize Embeddings

The system will automatically generate embeddings for your trades when:
- You first open the AI chat with vector search enabled
- You add new trades (embeddings are generated in the background)

### 3. Configuration

Vector search is enabled by default. You can configure it in your AI chat settings:

```typescript
// In your AI chat config
{
  useVectorSearch: true,        // Enable/disable vector search
  vectorSearchLimit: 20,       // Number of relevant trades to include
  maxContextTrades: 100         // Fallback limit for non-vector search
}
```

## How It Works

### Traditional Approach (Before)
```
User Query: "Show me my losing trades from last month"
↓
AI Context: [ALL 500+ trades as JSON] + query
↓
Token Usage: ~50,000+ tokens
```

### Vector Search Approach (After)
```
User Query: "Show me my losing trades from last month"
↓
Generate Query Embedding
↓
Find 20 Most Similar Trades using Vector Search
↓
AI Context: [20 relevant trades] + summary stats + query
↓
Token Usage: ~5,000 tokens (90% reduction!)
```

## Technical Implementation

### Services Created

1. **TradeEmbeddingService** (`src/services/tradeEmbeddingService.ts`)
   - Generates embeddings for trades using Firebase AI Logic
   - Stores embeddings in Firestore with metadata
   - Performs vector similarity search

2. **OptimizedAIContextService** (`src/services/optimizedAIContextService.ts`)
   - Generates lightweight context with only relevant trades
   - Maintains summary statistics for overall performance view
   - Handles fallback to traditional method if needed

### Data Structure

Trade embeddings are stored in Firestore as:
```typescript
{
  id: "calendarId_tradeId",
  tradeId: "trade123",
  calendarId: "calendar456", 
  embedding: [0.1, 0.2, ...], // 768-dimensional vector
  metadata: {
    name: "EUR/USD Long",
    date: 1640995200,
    session: "London",
    type: "win",
    amount: 150.50,
    tags: ["breakout", "trend"],
    notes: "Clean breakout above resistance"
  },
  textContent: "Trade: EUR/USD Long. Session: London. Type: win. Amount: $150.50..."
}
```

## Monitoring and Troubleshooting

### Check if Vector Search is Working

1. Open browser dev tools
2. Go to AI chat
3. Send a message
4. Look for logs like:
   ```
   "Found X relevant trades using vector search"
   "Optimized AI context generated successfully"
   ```

### Fallback Behavior

If vector search fails, the system automatically falls back to:
- Using most recent trades (traditional approach)
- Showing appropriate error messages
- Continuing to work normally

### Performance Monitoring

Monitor these metrics:
- Token usage per query (should be significantly reduced)
- Response time (should be faster)
- Embedding generation time (one-time cost per trade)

## Migration Notes

- Existing AI chat functionality remains unchanged
- Vector search is opt-in via configuration
- No breaking changes to existing code
- Embeddings are generated lazily (on-demand)

## Future Enhancements

Potential improvements:
1. **Batch Embedding Updates**: Update embeddings when trades are modified
2. **Semantic Categories**: Group similar trades automatically
3. **Query Expansion**: Enhance user queries for better search results
4. **Caching**: Cache frequent query embeddings
5. **Analytics**: Track which trades are most relevant to different query types
