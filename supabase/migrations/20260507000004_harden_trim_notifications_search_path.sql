-- Pin search_path on the trim trigger function to prevent search_path
-- hijacking. Recommended by supabase/lint:0011 (function_search_path_mutable).
ALTER FUNCTION public.trim_notifications_to_cap()
  SET search_path = public, pg_temp;
