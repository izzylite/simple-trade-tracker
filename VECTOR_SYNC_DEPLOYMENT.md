# Vector Sync Cloud Functions Deployment Guide

## 🚀 **Overview**

Vector sync has been moved to Firebase Cloud Functions for better performance, reliability, and automatic processing. The cloud functions automatically sync trades to Supabase vector database when Firebase documents change.

## 📋 **Prerequisites**

1. **Supabase Project**: Your existing Supabase project with vector database setup
2. **Firebase Project**: Your existing Firebase project
3. **Service Account**: Supabase service role key (not anon key)

## 🔧 **Setup Instructions**

### 1. **Install Dependencies**

```bash
cd functions
npm install
```

### 2. **Configure Environment Variables**

Create a `.env` file in the `functions` directory:

```bash
cd functions
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://gwubzauelilziaqnsfac.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
```

**Important**: Use the **service role key**, not the anon key. This key has full database access needed for server-side operations.

### 3. **Set Firebase Environment Variables**

```bash
# Set Supabase URL
firebase functions:config:set supabase.url="https://gwubzauelilziaqnsfac.supabase.co"

# Set Supabase service key
firebase functions:config:set supabase.service_key="your-service-role-key-here"
```

### 4. **Deploy Cloud Functions**

```bash
# Build and deploy
npm run build
firebase deploy --only functions
```

## 🔄 **How It Works**

### **Automatic Triggers**

The cloud functions automatically trigger on:

1. **Year Document Created**: When a new year document is created with trades
2. **Year Document Updated**: When trades are added, modified, or deleted
3. **Year Document Deleted**: When a year document is removed

### **Smart Change Detection**

The functions intelligently detect:
- ✅ **Added Trades**: New trades get embeddings generated
- ✅ **Updated Trades**: Modified trades get embeddings regenerated  
- ✅ **Deleted Trades**: Removed trades get embeddings deleted
- ✅ **Bulk Operations**: Handles import/export efficiently

### **Vector Sync Process**

For each trade change:
1. **Generate Embedding**: Creates hash-based embedding from trade data
2. **Store in Supabase**: Upserts to `trade_embeddings` table
3. **Update Metadata**: Updates sync statistics in `embedding_metadata` table
4. **Error Handling**: Logs errors but doesn't break Firebase operations

## 📊 **Monitoring**

### **View Function Logs**

```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only syncTradesOnYearUpdate

# Follow logs in real-time
firebase functions:log --follow
```

### **Check Sync Status**

You can verify sync is working by:

1. **Adding a trade** in your app
2. **Checking Firebase logs** for sync messages
3. **Querying Supabase** to see new embeddings

```sql
-- Check recent embeddings
SELECT trade_id, trade_type, trade_date, embedded_content 
FROM trade_embeddings 
ORDER BY trade_date DESC 
LIMIT 10;

-- Check sync metadata
SELECT * FROM embedding_metadata;
```

## 🛠️ **Troubleshooting**

### **Common Issues**

1. **Environment Variables Not Set**
   ```bash
   # Check current config
   firebase functions:config:get
   
   # Set missing variables
   firebase functions:config:set supabase.url="your-url"
   ```

2. **Supabase Connection Failed**
   - Verify service key has correct permissions
   - Check Supabase URL is correct
   - Ensure `trade_embeddings` table exists

3. **Function Timeout**
   - Large batch operations might timeout
   - Functions automatically retry failed operations
   - Check logs for specific error messages

### **Debug Mode**

Enable detailed logging by updating the function:

```typescript
// In vectorSync.ts, add more logging
logger.info('Processing trade change', { tradeId: trade.id, operation });
```

## 🔄 **Migration from Frontend Sync**

The frontend vector sync code has been removed:
- ✅ `vectorSyncService.ts` - Removed
- ✅ `useVectorSync.ts` - Removed  
- ✅ `VectorSyncStatus.tsx` - Removed
- ✅ Calendar service sync calls - Removed

All sync now happens automatically via cloud functions!

## 🎯 **Benefits**

- **🔄 Automatic**: No manual sync needed
- **⚡ Fast**: Server-side processing
- **🛡️ Reliable**: Retry logic and error handling
- **📈 Scalable**: Handles high volume efficiently
- **🔒 Secure**: Server-side API keys
- **👁️ Transparent**: Comprehensive logging

## 🚀 **Next Steps**

1. **Deploy the functions** using the instructions above
2. **Test by adding/editing trades** in your app
3. **Monitor logs** to ensure sync is working
4. **Verify embeddings** are being created in Supabase

Your AI chat will now automatically have access to the latest trade data without any frontend sync complexity! 🎉
