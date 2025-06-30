-- Search Performance Optimization Indexes
-- Run this script to improve search performance

-- 1. Create index on LOWER(name) for case-insensitive prefix searches
CREATE INDEX IF NOT EXISTS idx_card_name_lower ON "Card" (LOWER(name));

-- 2. Create index on number field for card number searches
CREATE INDEX IF NOT EXISTS idx_card_number ON "Card" (number);

-- 3. Create trigram index for fuzzy search (requires pg_trgm extension)
-- This allows for efficient "contains" searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_card_name_trgm ON "Card" USING gin (name gin_trgm_ops);

-- 4. Create composite index for name pattern matching
-- This helps with searches that use LIKE patterns
CREATE INDEX IF NOT EXISTS idx_card_name_pattern ON "Card" (name varchar_pattern_ops);

-- 5. Create partial index for cards with numbers (most cards have numbers)
CREATE INDEX IF NOT EXISTS idx_card_number_pattern ON "Card" (number varchar_pattern_ops) WHERE number IS NOT NULL;

-- 6. Analyze tables to update query planner statistics
ANALYZE "Card";
ANALYZE "Set";

-- Check index sizes
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
FROM pg_indexes
WHERE tablename = 'Card'
ORDER BY pg_relation_size(schemaname||'.'||indexname) DESC;