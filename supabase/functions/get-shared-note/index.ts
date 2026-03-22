/**
 * Get Shared Note Edge Function
 * Queries notes table using share_id field, returns safe fields only
 */
import {
  createServiceClient,
  errorResponse,
  successResponse,
  handleCors,
  log,
  parseJsonBody
} from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    log('Get shared note request received');

    const payload = await parseJsonBody<{ shareId: string }>(req);
    if (!payload) {
      return errorResponse('Invalid JSON payload', 400);
    }

    const { shareId } = payload;
    if (!shareId) {
      return errorResponse('Missing shareId parameter', 400);
    }

    const supabase = createServiceClient();

    const { data: note, error: noteError } = await supabase
      .from('notes')
      .select(
        'title, content, cover_image, color, tags, created_at, shared_at'
      )
      .eq('share_id', shareId)
      .eq('is_shared', true)
      .single();

    if (noteError || !note) {
      return errorResponse('Shared note not found', 404);
    }

    log(`Shared note ${shareId} viewed`);

    return successResponse({
      title: note.title,
      content: note.content,
      cover_image: note.cover_image,
      color: note.color,
      tags: note.tags || [],
      created_at: note.created_at,
      shared_at: note.shared_at,
    });
  } catch (error) {
    log('Error getting shared note', 'error', error);
    return errorResponse('Internal server error', 500);
  }
});
