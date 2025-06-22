-- Performance optimization indexes for Pokemon TCG Deck Builder

-- Card search optimization indexes
CREATE INDEX idx_cards_name_gin ON "Card" USING gin(to_tsvector('english', name));
CREATE INDEX idx_cards_description_gin ON "Card" USING gin(to_tsvector('english', description));
CREATE INDEX idx_cards_supertype_rarity ON "Card"(supertype, rarity);
CREATE INDEX idx_cards_set_number ON "Card"(set_id, number);
CREATE INDEX idx_cards_types ON "Card" USING gin(types);
CREATE INDEX idx_cards_hp_range ON "Card"(hp) WHERE hp IS NOT NULL;
CREATE INDEX idx_cards_retreat_cost ON "Card"(retreat_cost) WHERE retreat_cost IS NOT NULL;

-- Partial indexes for format-specific queries
CREATE INDEX idx_cards_standard_legal ON "Card"(id) WHERE is_standard_legal = true;
CREATE INDEX idx_cards_expanded_legal ON "Card"(id) WHERE is_expanded_legal = true;

-- Set and format indexes
CREATE INDEX idx_sets_release_date ON "Set"(release_date DESC);
CREATE INDEX idx_sets_series ON "Set"(series);
CREATE INDEX idx_formats_active ON "Format"(is_active) WHERE is_active = true;

-- Deck and collection indexes
CREATE INDEX idx_decks_user_public ON "Deck"(user_id, is_public, updated_at DESC);
CREATE INDEX idx_decks_format ON "Deck"(format_id, updated_at DESC);
CREATE INDEX idx_deck_cards_deck_card ON "DeckCard"(deck_id, card_id);
CREATE INDEX idx_user_collection_user_card ON "UserCollection"(user_id, card_id);

-- Price and trading indexes
CREATE INDEX idx_card_prices_card_updated ON "CardPrice"(card_id, updated_at DESC);
CREATE INDEX idx_price_history_card_date ON "PriceHistory"(card_id, date DESC);
CREATE INDEX idx_trade_offers_status ON "TradeOffer"(status, created_at DESC);
CREATE INDEX idx_price_alerts_user_active ON "PriceAlert"(user_id, is_active) WHERE is_active = true;

-- Matchup and statistics indexes
CREATE INDEX idx_matchups_deck ON "Matchup"(deck_id, created_at DESC);
CREATE INDEX idx_matchups_opponent ON "Matchup"(opponent_deck_id);
CREATE INDEX idx_deck_stats_calculated ON "Deck"(stats_calculated_at) WHERE stats_calculated_at IS NOT NULL;

-- Composite indexes for complex queries
CREATE INDEX idx_cards_search_composite ON "Card"(
  supertype,
  set_id,
  is_standard_legal,
  is_expanded_legal
);

CREATE INDEX idx_collection_stats ON "UserCollection"(
  user_id,
  card_id,
  quantity,
  condition
) INCLUDE (acquired_price, acquired_date);

-- Function-based indexes for calculated fields
CREATE INDEX idx_decks_total_cards ON "Deck"((
  SELECT SUM(quantity) FROM "DeckCard" WHERE deck_id = "Deck".id
));

-- Indexes for sorting and filtering
CREATE INDEX idx_cards_name_sort ON "Card"(name COLLATE "C");
CREATE INDEX idx_cards_tcgplayer_sort ON "Card"(tcgplayer_id) WHERE tcgplayer_id IS NOT NULL;

-- Analyze tables for query planner optimization
ANALYZE "Card";
ANALYZE "Set";
ANALYZE "Deck";
ANALYZE "UserCollection";
ANALYZE "CardPrice";