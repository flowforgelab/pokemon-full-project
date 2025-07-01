# Deck Templates

This directory contains predefined deck templates for the Pokemon TCG Deck Builder, including official product deck lists.

## Available Templates

### Rayquaza-GX Battle Arena Deck (`rayquaza-gx-battle-arena`)
- **Released**: October 25, 2019
- **Format**: Standard (at time of release)
- **Description**: Official Battle Arena deck featuring Rayquaza-GX with Lightning-type focus
- **Strategy**: Speed and power combination using Magnezone's Magnetic Circuit ability

## Using Templates

### In the Deck Builder
1. When creating a new deck, select a template from the dropdown
2. The deck will be pre-populated with all cards from the template
3. You can then modify the deck as needed

### Via API
```javascript
// Create a new deck with a template
POST /api/deck-builder/create
{
  "name": "My Rayquaza Deck",
  "template": "rayquaza-gx-battle-arena"
}
```

### Via Import
You can also import the deck using the text format found in `rayquaza-gx-import.txt`.

## Adding New Templates

To add a new deck template:

1. Add the deck data to `battle-arena-decks.json` (or create a new JSON file)
2. Follow the existing format:
   ```json
   {
     "template-id": {
       "name": "Deck Name",
       "description": "Deck description",
       "format": "standard",
       "releaseDate": "YYYY-MM-DD",
       "cards": [
         {
           "name": "Card Name",
           "set": "SET",
           "number": "123",
           "quantity": 4,
           "category": "pokemon|trainer|energy"
         }
       ],
       "strategy": {
         "overview": "...",
         "keyCards": ["..."],
         "gameplan": "..."
       }
     }
   }
   ```

3. Import the new file in `index.ts` if using a separate file

## Card Set Codes

Common set codes used in templates:
- CES: Celestial Storm
- TEU: Team Up
- UNB: Unbroken Bonds
- LOT: Lost Thunder
- FLI: Forbidden Light
- UPR: Ultra Prism
- SUM: Sun & Moon Base

## Notes

- Prism Star cards should be written as "Card Name Prism Star" (not using the ♢ symbol)
- Basic Energy cards use "Energy" as the set code
- Ensure all decks total exactly 60 cards
- Include strategy information to help players understand the deck