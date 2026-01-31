-- =====================================================
-- Migration: Prevent Circular Calendar Links
-- =====================================================
-- Adds a trigger to prevent circular linking chains
-- Example: A → B → A or A → B → C → A

-- Function to check for circular links
CREATE OR REPLACE FUNCTION check_circular_calendar_link()
RETURNS TRIGGER AS $$
DECLARE
    current_id UUID;
    visited_ids UUID[];
    max_depth INT := 10; -- Safety limit for chain depth
    depth INT := 0;
BEGIN
    -- If not setting a link, allow the operation
    IF NEW.linked_to_calendar_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Start from the target calendar
    current_id := NEW.linked_to_calendar_id;
    visited_ids := ARRAY[NEW.id];

    -- Follow the chain of links
    WHILE current_id IS NOT NULL AND depth < max_depth LOOP
        -- Check if we've found a cycle back to our calendar
        IF current_id = ANY(visited_ids) THEN
            RAISE EXCEPTION 'Circular calendar link detected. Cannot create link that would form a cycle.';
        END IF;

        -- Add current to visited
        visited_ids := visited_ids || current_id;

        -- Get the next link in the chain
        SELECT linked_to_calendar_id INTO current_id
        FROM calendars
        WHERE id = current_id;

        depth := depth + 1;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to check before insert or update
DROP TRIGGER IF EXISTS prevent_circular_calendar_link ON calendars;
CREATE TRIGGER prevent_circular_calendar_link
    BEFORE INSERT OR UPDATE OF linked_to_calendar_id ON calendars
    FOR EACH ROW
    EXECUTE FUNCTION check_circular_calendar_link();

COMMENT ON FUNCTION check_circular_calendar_link() IS
    'Prevents circular calendar links by checking if setting a link would create a cycle.';
