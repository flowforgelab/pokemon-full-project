-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateEnum
CREATE TYPE "Supertype" AS ENUM ('POKEMON', 'TRAINER', 'ENERGY');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'RARE_HOLO', 'RARE_HOLO_EX', 'RARE_HOLO_GX', 'RARE_HOLO_V', 'RARE_HOLO_VMAX', 'RARE_HOLO_VSTAR', 'RARE_ULTRA', 'RARE_SECRET', 'RARE_PRIME', 'RARE_ACE', 'RARE_BREAK', 'LEGEND', 'PROMO', 'AMAZING_RARE');

-- CreateEnum
CREATE TYPE "CardCondition" AS ENUM ('MINT', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED');

-- CreateEnum
CREATE TYPE "DeckType" AS ENUM ('CONSTRUCTED', 'LIMITED', 'PRERELEASE', 'THEME', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DeckCategory" AS ENUM ('MAIN', 'SIDEBOARD');

-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('TCGPLAYER', 'CARDMARKET', 'EBAY', 'LOCAL');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('MARKET', 'LOW', 'MID', 'HIGH', 'FOIL_LOW', 'FOIL_MARKET', 'FOIL_HIGH');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'ULTIMATE');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ABOVE', 'BELOW');

-- CreateTable
CREATE TABLE "Set" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "printedTotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "logoUrl" TEXT,
    "symbolUrl" TEXT,
    "ptcgoCode" TEXT,
    "tcgplayerGroupId" INTEGER,
    "isLegalStandard" BOOLEAN NOT NULL DEFAULT false,
    "isLegalExpanded" BOOLEAN NOT NULL DEFAULT false,
    "isLegalUnlimited" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supertype" "Supertype" NOT NULL,
    "subtypes" TEXT[],
    "level" TEXT,
    "hp" TEXT,
    "types" TEXT[],
    "evolvesFrom" TEXT,
    "evolvesTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attacks" JSONB,
    "abilities" JSONB,
    "weaknesses" JSONB,
    "resistances" JSONB,
    "rules" TEXT[],
    "retreatCost" TEXT[],
    "convertedRetreatCost" INTEGER NOT NULL DEFAULT 0,
    "setId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "printedNumber" TEXT,
    "artist" TEXT,
    "rarity" "Rarity",
    "flavorText" TEXT,
    "nationalPokedexNumbers" INTEGER[],
    "regulationMark" TEXT,
    "imageUrlSmall" TEXT NOT NULL,
    "imageUrlLarge" TEXT NOT NULL,
    "tcgplayerId" TEXT,
    "cardmarketId" TEXT,
    "isLegalStandard" BOOLEAN NOT NULL DEFAULT false,
    "isLegalExpanded" BOOLEAN NOT NULL DEFAULT false,
    "isLegalUnlimited" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerkUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionEnd" TIMESTAMP(3),
    "preferences" JSONB,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCollection" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "quantityFoil" INTEGER NOT NULL DEFAULT 0,
    "condition" "CardCondition" NOT NULL DEFAULT 'NEAR_MINT',
    "language" TEXT NOT NULL DEFAULT 'EN',
    "purchasePrice" DECIMAL(10,2),
    "acquiredDate" TIMESTAMP(3),
    "notes" TEXT,
    "isWishlist" BOOLEAN NOT NULL DEFAULT false,
    "isForTrade" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Format" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rotationDate" TIMESTAMP(3),
    "maxDeckSize" INTEGER NOT NULL DEFAULT 60,
    "maxCopies" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Format_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formatId" UUID,
    "deckType" "DeckType" NOT NULL DEFAULT 'CONSTRUCTED',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "coverCardId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastPlayedAt" TIMESTAMP(3),

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckCard" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deckId" UUID NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "category" "DeckCategory" NOT NULL DEFAULT 'MAIN',
    "position" INTEGER,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPrice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cardId" TEXT NOT NULL,
    "source" "PriceSource" NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "url" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cardId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "PriceSource" NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "volume" INTEGER,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strategy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "archetype" TEXT NOT NULL,
    "tier" INTEGER,
    "gameplan" JSONB,
    "counterStrategies" TEXT[],
    "weaknesses" TEXT[],
    "strengths" TEXT[],
    "formatId" UUID,
    "popularityScore" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOffer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "offererId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "offeredCards" JSONB NOT NULL,
    "requestedCards" JSONB NOT NULL,
    "message" TEXT,
    "counterOfferId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "TradeOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "cardId" TEXT NOT NULL,
    "targetPrice" DECIMAL(10,2) NOT NULL,
    "alertType" "AlertType" NOT NULL DEFAULT 'BELOW',
    "priceType" "PriceType" NOT NULL DEFAULT 'MARKET',
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggered" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matchup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "deckId" UUID NOT NULL,
    "opponentDeckId" UUID NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StrategyCards" (
    "A" TEXT NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_StrategyCards_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_FormatSets" (
    "A" UUID NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_FormatSets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Set_code_key" ON "Set"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Set_tcgplayerGroupId_key" ON "Set"("tcgplayerGroupId");

-- CreateIndex
CREATE INDEX "Set_series_idx" ON "Set"("series");

-- CreateIndex
CREATE INDEX "Set_releaseDate_idx" ON "Set"("releaseDate");

-- CreateIndex
CREATE INDEX "Set_isLegalStandard_isLegalExpanded_idx" ON "Set"("isLegalStandard", "isLegalExpanded");

-- CreateIndex
CREATE UNIQUE INDEX "Card_tcgplayerId_key" ON "Card"("tcgplayerId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_cardmarketId_key" ON "Card"("cardmarketId");

-- CreateIndex
CREATE INDEX "Card_name_idx" ON "Card"("name");

-- CreateIndex
CREATE INDEX "Card_setId_number_idx" ON "Card"("setId", "number");

-- CreateIndex
CREATE INDEX "Card_supertype_idx" ON "Card"("supertype");

-- CreateIndex
CREATE INDEX "Card_types_idx" ON "Card"("types");

-- CreateIndex
CREATE INDEX "Card_rarity_idx" ON "Card"("rarity");

-- CreateIndex
CREATE INDEX "Card_artist_idx" ON "Card"("artist");

-- CreateIndex
CREATE INDEX "Card_isLegalStandard_isLegalExpanded_idx" ON "Card"("isLegalStandard", "isLegalExpanded");

-- CreateIndex
CREATE INDEX "Card_tcgplayerId_idx" ON "Card"("tcgplayerId");

-- CreateIndex
CREATE INDEX "Card_cardmarketId_idx" ON "Card"("cardmarketId");

-- CreateIndex
CREATE INDEX "Card_name_flavorText_idx" ON "Card"("name", "flavorText");

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_clerkUserId_idx" ON "User"("clerkUserId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_subscriptionTier_idx" ON "User"("subscriptionTier");

-- CreateIndex
CREATE INDEX "UserCollection_userId_idx" ON "UserCollection"("userId");

-- CreateIndex
CREATE INDEX "UserCollection_cardId_idx" ON "UserCollection"("cardId");

-- CreateIndex
CREATE INDEX "UserCollection_isWishlist_idx" ON "UserCollection"("isWishlist");

-- CreateIndex
CREATE INDEX "UserCollection_isForTrade_idx" ON "UserCollection"("isForTrade");

-- CreateIndex
CREATE UNIQUE INDEX "UserCollection_userId_cardId_condition_language_isWishlist_key" ON "UserCollection"("userId", "cardId", "condition", "language", "isWishlist");

-- CreateIndex
CREATE UNIQUE INDEX "Format_name_key" ON "Format"("name");

-- CreateIndex
CREATE INDEX "Format_isActive_idx" ON "Format"("isActive");

-- CreateIndex
CREATE INDEX "Deck_userId_idx" ON "Deck"("userId");

-- CreateIndex
CREATE INDEX "Deck_formatId_idx" ON "Deck"("formatId");

-- CreateIndex
CREATE INDEX "Deck_isPublic_idx" ON "Deck"("isPublic");

-- CreateIndex
CREATE INDEX "Deck_deckType_idx" ON "Deck"("deckType");

-- CreateIndex
CREATE INDEX "Deck_tags_idx" ON "Deck"("tags");

-- CreateIndex
CREATE INDEX "DeckCard_deckId_idx" ON "DeckCard"("deckId");

-- CreateIndex
CREATE INDEX "DeckCard_cardId_idx" ON "DeckCard"("cardId");

-- CreateIndex
CREATE INDEX "DeckCard_category_idx" ON "DeckCard"("category");

-- CreateIndex
CREATE UNIQUE INDEX "DeckCard_deckId_cardId_category_key" ON "DeckCard"("deckId", "cardId", "category");

-- CreateIndex
CREATE INDEX "CardPrice_cardId_idx" ON "CardPrice"("cardId");

-- CreateIndex
CREATE INDEX "CardPrice_source_idx" ON "CardPrice"("source");

-- CreateIndex
CREATE INDEX "CardPrice_updatedAt_idx" ON "CardPrice"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardPrice_cardId_source_priceType_currency_key" ON "CardPrice"("cardId", "source", "priceType", "currency");

-- CreateIndex
CREATE INDEX "PriceHistory_cardId_date_idx" ON "PriceHistory"("cardId", "date");

-- CreateIndex
CREATE INDEX "PriceHistory_date_idx" ON "PriceHistory"("date");

-- CreateIndex
CREATE INDEX "PriceHistory_source_idx" ON "PriceHistory"("source");

-- CreateIndex
CREATE UNIQUE INDEX "PriceHistory_cardId_date_source_priceType_currency_key" ON "PriceHistory"("cardId", "date", "source", "priceType", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "Strategy_name_key" ON "Strategy"("name");

-- CreateIndex
CREATE INDEX "Strategy_archetype_idx" ON "Strategy"("archetype");

-- CreateIndex
CREATE INDEX "Strategy_tier_idx" ON "Strategy"("tier");

-- CreateIndex
CREATE INDEX "Strategy_formatId_idx" ON "Strategy"("formatId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOffer_counterOfferId_key" ON "TradeOffer"("counterOfferId");

-- CreateIndex
CREATE INDEX "TradeOffer_offererId_idx" ON "TradeOffer"("offererId");

-- CreateIndex
CREATE INDEX "TradeOffer_receiverId_idx" ON "TradeOffer"("receiverId");

-- CreateIndex
CREATE INDEX "TradeOffer_status_idx" ON "TradeOffer"("status");

-- CreateIndex
CREATE INDEX "TradeOffer_createdAt_idx" ON "TradeOffer"("createdAt");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_cardId_idx" ON "PriceAlert"("cardId");

-- CreateIndex
CREATE INDEX "PriceAlert_isActive_idx" ON "PriceAlert"("isActive");

-- CreateIndex
CREATE INDEX "Matchup_deckId_idx" ON "Matchup"("deckId");

-- CreateIndex
CREATE INDEX "Matchup_opponentDeckId_idx" ON "Matchup"("opponentDeckId");

-- CreateIndex
CREATE UNIQUE INDEX "Matchup_deckId_opponentDeckId_key" ON "Matchup"("deckId", "opponentDeckId");

-- CreateIndex
CREATE INDEX "_StrategyCards_B_index" ON "_StrategyCards"("B");

-- CreateIndex
CREATE INDEX "_FormatSets_B_index" ON "_FormatSets"("B");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollection" ADD CONSTRAINT "UserCollection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCollection" ADD CONSTRAINT "UserCollection_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_formatId_fkey" FOREIGN KEY ("formatId") REFERENCES "Format"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPrice" ADD CONSTRAINT "CardPrice_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_offererId_fkey" FOREIGN KEY ("offererId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOffer" ADD CONSTRAINT "TradeOffer_counterOfferId_fkey" FOREIGN KEY ("counterOfferId") REFERENCES "TradeOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_opponentDeckId_fkey" FOREIGN KEY ("opponentDeckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StrategyCards" ADD CONSTRAINT "_StrategyCards_A_fkey" FOREIGN KEY ("A") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StrategyCards" ADD CONSTRAINT "_StrategyCards_B_fkey" FOREIGN KEY ("B") REFERENCES "Strategy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormatSets" ADD CONSTRAINT "_FormatSets_A_fkey" FOREIGN KEY ("A") REFERENCES "Format"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FormatSets" ADD CONSTRAINT "_FormatSets_B_fkey" FOREIGN KEY ("B") REFERENCES "Set"("id") ON DELETE CASCADE ON UPDATE CASCADE;
