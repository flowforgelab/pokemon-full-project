-- RemoveTCGPlayerIntegration

-- Step 1: Remove tcgplayerId from Card table
ALTER TABLE "Card" DROP COLUMN IF EXISTS "tcgplayerId";

-- Step 2: Remove tcgplayerProductId from Card table (if exists)
ALTER TABLE "Card" DROP COLUMN IF EXISTS "tcgplayerProductId";

-- Step 3: Update PriceSource enum - remove TCGPLAYER
-- First, update any existing TCGPLAYER prices to a different source or delete them
DELETE FROM "CardPrice" WHERE "source" = 'TCGPLAYER';
DELETE FROM "PriceHistory" WHERE "source" = 'TCGPLAYER';

-- Note: In PostgreSQL, we cannot directly modify enums. 
-- We need to create a new enum and migrate the data
CREATE TYPE "PriceSource_new" AS ENUM ('CARDMARKET', 'EBAY', 'LOCAL');

-- Update the tables to use the new enum
ALTER TABLE "CardPrice" ALTER COLUMN "source" TYPE "PriceSource_new" USING ("source"::text::"PriceSource_new");
ALTER TABLE "PriceHistory" ALTER COLUMN "source" TYPE "PriceSource_new" USING ("source"::text::"PriceSource_new");

-- Drop the old enum and rename the new one
DROP TYPE "PriceSource";
ALTER TYPE "PriceSource_new" RENAME TO "PriceSource";

-- Step 4: Drop indexes related to tcgplayerId
DROP INDEX IF EXISTS "Card_tcgplayerId_idx";

-- Step 5: Update any stored procedures or functions that reference TCGPlayer (if any)
-- None found in the current schema

-- Step 6: Add comment to document the removal
COMMENT ON TABLE "CardPrice" IS 'Card pricing data - TCGPlayer integration removed on 2025-06-23';
COMMENT ON TABLE "PriceHistory" IS 'Historical price tracking - TCGPlayer integration removed on 2025-06-23';