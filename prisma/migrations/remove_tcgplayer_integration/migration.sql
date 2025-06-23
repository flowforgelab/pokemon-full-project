-- Remove TCGPlayer integration
-- This migration removes all TCGPlayer-related fields and data

-- Drop the tcgplayerGroupId column from Set table
ALTER TABLE "Set" DROP COLUMN IF EXISTS "tcgplayerGroupId";

-- Clean up any TCGPlayer price data (if PriceSource had TCGPLAYER)
-- Note: Since TCGPLAYER is not in the enum, this is just for safety
DELETE FROM "CardPrice" WHERE "source" = 'TCGPLAYER';
DELETE FROM "PriceHistory" WHERE "source" = 'TCGPLAYER';