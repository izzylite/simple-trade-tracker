/**
 * Cleanup Scheduler Edge Function
 *
 * Runs on cron schedule (every 15 minutes) to:
 * 1. Mark expired calendars for deletion
 * 2. Cleanup orphaned storage files from notes
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function createServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`)
}

async function cleanupExpiredCalendars() {
  log('Starting cleanup of expired calendars');
  const supabase = createServiceClient();
  const now = new Date();
  const errors: string[] = [];

  const { data: expiredCalendars, error: fetchError } = await supabase
    .from('calendars')
    .select('id, name')
    .not('deleted_at', 'is', null)
    .not('auto_delete_at', 'is', null)
    .lt('auto_delete_at', now.toISOString())
    .limit(1000);

  if (fetchError) throw fetchError;
  if (!expiredCalendars || expiredCalendars.length === 0) {
    log('No expired calendars found');
    return { markedCount: 0, errors: [] };
  }

  log(`Found ${expiredCalendars.length} expired calendars`);
  let markedCount = 0;

  for (const cal of expiredCalendars) {
    const { error } = await supabase
      .from('calendars')
      .update({ mark_for_deletion: true, deletion_date: now.toISOString() })
      .eq('id', cal.id);
    if (error) errors.push(`${cal.id}: ${error.message}`);
    else markedCount++;
  }

  log(`Marked ${markedCount} calendars for deletion`);
  return { markedCount, errors };
}

async function cleanupOrphanedStorage() {
  log('Starting cleanup of orphaned storage');
  const supabase = createServiceClient();

  const { data: items, error } = await supabase
    .from('storage_cleanup_queue')
    .select('*')
    .eq('status', 'pending')
    .lt('retry_count', 3)
    .order('created_at')
    .limit(50);

  if (error || !items?.length) {
    log('No pending storage cleanup items');
    return { deleted: 0, failed: 0 };
  }

  log(`Found ${items.length} files to cleanup`);
  let deleted = 0, failed = 0;

  for (const item of items) {
    await supabase.from('storage_cleanup_queue').update({ status: 'processing' }).eq('id', item.id);

    const { error: delErr } = await supabase.storage.from(item.bucket_id).remove([item.file_path]);

    if (delErr && !delErr.message?.includes('not found')) {
      await supabase.from('storage_cleanup_queue').update({
        status: (item.retry_count || 0) + 1 >= 3 ? 'failed' : 'pending',
        retry_count: (item.retry_count || 0) + 1,
        error_message: delErr.message
      }).eq('id', item.id);
      failed++;
    } else {
      await supabase.from('storage_cleanup_queue').update({
        status: 'completed',
        processed_at: new Date().toISOString()
      }).eq('id', item.id);
      deleted++;
    }
  }

  // Cleanup old entries (older than 7 days)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  await supabase
    .from('storage_cleanup_queue')
    .delete()
    .in('status', ['completed', 'failed'])
    .lt('processed_at', cutoff.toISOString());

  log(`Storage cleanup: ${deleted} deleted, ${failed} failed`);
  return { deleted, failed };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    log('Cleanup function triggered');
    const cal = await cleanupExpiredCalendars();
    const storage = await cleanupOrphanedStorage();

    return new Response(JSON.stringify({
      success: true,
      calendars: cal,
      storage: storage,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (e) {
    log(`Error: ${e}`);
    return new Response(JSON.stringify({
      success: false,
      error: String(e)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
