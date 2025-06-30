# TCGPlayer Integration Documentation

## Current Status

As of June 30, 2025, we've discovered that direct TCGPlayer product URLs cannot be obtained from the Pokemon TCG API.

### What the Pokemon TCG API Provides:

The `tcgplayer` object in the API response contains:
- `url`: A link to the Pokemon TCG API's price endpoint (e.g., `https://prices.pokemontcg.io/tcgplayer/pgo-11`)
- `prices`: Current market prices in USD
- `updatedAt`: Last price update date

### TCGPlayer URL Structure:

TCGPlayer uses the format:
```
https://www.tcgplayer.com/product/{productId}/{seo-friendly-text}
```

Example:
```
https://www.tcgplayer.com/product/276996/pokemon-pokemon-go-pokestop
```

### Current Implementation:

We generate search URLs that take users to TCGPlayer search results:
```
https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q={card_name}&view=grid&ProductTypeName=Cards&set={set_name}
```

This ensures users can find the card, though it's not a direct link.

## Future Improvements

### Option 1: TCGPlayer API Integration
- Register for TCGPlayer API access
- Create a mapping between Pokemon TCG IDs and TCGPlayer product IDs
- Store TCGPlayer product IDs in the database
- Generate direct product URLs

### Option 2: Web Scraping (Not Recommended)
- Search TCGPlayer for each card
- Extract the product ID from search results
- Violates TCGPlayer's terms of service

### Option 3: Manual Mapping
- For popular cards, manually map TCGPlayer product IDs
- Maintain a lookup table
- Fall back to search URLs for unmapped cards

## Affiliate Program Integration

When implementing TCGPlayer's affiliate program:
1. Replace base URL with affiliate URL
2. Add tracking parameters
3. Ensure compliance with TCGPlayer's affiliate terms

## Code Locations

- URL generation: `/src/lib/api/transformers.ts` (line 101-104)
- Card display: `/src/components/cards/CardDetailModal.tsx`
- Purchase button: Uses the `purchaseUrl` field from the database

## Database Considerations

Current schema stores `purchaseUrl` as a string. No changes needed for future direct URL implementation.