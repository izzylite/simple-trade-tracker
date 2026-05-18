-- Diagnostic table from the previous migration is no longer needed —
-- the wrapper's outputsize-bypass bug was identified and fixed.
DROP TABLE IF EXISTS public.candle_cache_debug;
