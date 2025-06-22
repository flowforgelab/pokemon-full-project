import { Prisma, Rarity, Supertype } from '@prisma/client';
import type { PokemonTCGCard, PokemonTCGSet, TCGPlayerProduct } from './types';
import { z } from 'zod';

/**
 * Map Pokemon TCG API supertype to Prisma enum
 */
function mapSupertype(supertype: string): Supertype {
  const mapping: Record<string, Supertype> = {
    'Pokémon': Supertype.POKEMON,
    'Pokemon': Supertype.POKEMON,
    'Trainer': Supertype.TRAINER,
    'Energy': Supertype.ENERGY,
  };
  
  return mapping[supertype] || Supertype.POKEMON;
}

/**
 * Map Pokemon TCG API rarity to Prisma enum
 */
function mapRarity(rarity?: string): Rarity | null {
  if (!rarity) return null;

  const mapping: Record<string, Rarity> = {
    'Common': Rarity.COMMON,
    'Uncommon': Rarity.UNCOMMON,
    'Rare': Rarity.RARE,
    'Rare Holo': Rarity.RARE_HOLO,
    'Rare Holo EX': Rarity.RARE_HOLO_EX,
    'Rare Holo GX': Rarity.RARE_HOLO_GX,
    'Rare Holo V': Rarity.RARE_HOLO_V,
    'Rare Holo VMAX': Rarity.RARE_HOLO_VMAX,
    'Rare Holo VSTAR': Rarity.RARE_HOLO_VSTAR,
    'Rare Ultra': Rarity.RARE_ULTRA,
    'Rare Secret': Rarity.RARE_SECRET,
    'Rare Prime': Rarity.RARE_PRIME,
    'Rare ACE': Rarity.RARE_ACE,
    'Rare BREAK': Rarity.RARE_BREAK,
    'LEGEND': Rarity.LEGEND,
    'Promo': Rarity.PROMO,
    'Amazing Rare': Rarity.AMAZING_RARE,
  };

  return mapping[rarity] || Rarity.COMMON;
}

/**
 * Normalize set data from Pokemon TCG API to Prisma schema
 */
export function normalizeSetData(apiSet: PokemonTCGSet): Prisma.SetCreateInput {
  return {
    id: apiSet.id,
    code: apiSet.id, // Using ID as code since API doesn't provide separate code
    name: apiSet.name,
    series: apiSet.series,
    printedTotal: apiSet.printedTotal,
    total: apiSet.total,
    releaseDate: new Date(apiSet.releaseDate),
    updatedAt: new Date(apiSet.updatedAt),
    logoUrl: apiSet.images.logo,
    symbolUrl: apiSet.images.symbol,
    ptcgoCode: apiSet.ptcgoCode,
    isLegalStandard: apiSet.legalities.standard === 'Legal',
    isLegalExpanded: apiSet.legalities.expanded === 'Legal',
    isLegalUnlimited: apiSet.legalities.unlimited === 'Legal',
  };
}

/**
 * Normalize card data from Pokemon TCG API to Prisma schema
 */
export function normalizeCardData(apiCard: PokemonTCGCard): Prisma.CardCreateInput {
  // Transform attacks to JSON format
  const attacks = apiCard.attacks?.map(attack => ({
    name: attack.name,
    cost: attack.cost,
    damage: attack.damage || '',
    text: attack.text || '',
  })) || null;

  // Transform abilities to JSON format
  const abilities = apiCard.abilities?.map(ability => ({
    name: ability.name,
    type: ability.type,
    text: ability.text,
  })) || null;

  // Transform weaknesses to JSON format
  const weaknesses = apiCard.weaknesses?.map(weakness => ({
    type: weakness.type,
    value: weakness.value,
  })) || null;

  // Transform resistances to JSON format
  const resistances = apiCard.resistances?.map(resistance => ({
    type: resistance.type,
    value: resistance.value,
  })) || null;

  return {
    id: apiCard.id,
    name: apiCard.name,
    supertype: mapSupertype(apiCard.supertype),
    subtypes: apiCard.subtypes || [],
    level: apiCard.level,
    hp: apiCard.hp,
    types: apiCard.types || [],
    evolvesFrom: apiCard.evolvesFrom,
    evolvesTo: apiCard.evolvesTo || [],
    attacks: attacks as any,
    abilities: abilities as any,
    weaknesses: weaknesses as any,
    resistances: resistances as any,
    rules: apiCard.rules || [],
    retreatCost: apiCard.retreatCost || [],
    convertedRetreatCost: apiCard.convertedRetreatCost || 0,
    set: {
      connect: { id: apiCard.set.id }
    },
    number: apiCard.number,
    printedNumber: apiCard.number, // Using number as printedNumber
    artist: apiCard.artist,
    rarity: mapRarity(apiCard.rarity),
    flavorText: apiCard.flavorText,
    nationalPokedexNumbers: apiCard.nationalPokedexNumbers || [],
    regulationMark: apiCard.regulationMark,
    imageUrlSmall: apiCard.images.small,
    imageUrlLarge: apiCard.images.large,
    tcgplayerId: apiCard.tcgplayer?.url ? extractTCGPlayerIdFromUrl(apiCard.tcgplayer.url) : null,
    cardmarketId: apiCard.cardmarket?.url ? extractCardMarketIdFromUrl(apiCard.cardmarket.url) : null,
    isLegalStandard: apiCard.legalities.standard === 'Legal',
    isLegalExpanded: apiCard.legalities.expanded === 'Legal',
    isLegalUnlimited: apiCard.legalities.unlimited === 'Legal',
  };
}

/**
 * Extract TCGPlayer product ID from URL
 */
function extractTCGPlayerIdFromUrl(url: string): string | null {
  const match = url.match(/\/product\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract CardMarket product ID from URL
 */
function extractCardMarketIdFromUrl(url: string): string | null {
  const match = url.match(/\/Products\/Singles\/[^\/]+\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Map TCGPlayer product IDs to Pokemon TCG card IDs
 */
export function mapTCGPlayerIds(
  cards: PokemonTCGCard[],
  tcgPlayerProducts: TCGPlayerProduct[]
): Map<string, number> {
  const mapping = new Map<string, number>();
  
  // Create a name-to-product map for faster lookup
  const productMap = new Map<string, TCGPlayerProduct[]>();
  tcgPlayerProducts.forEach(product => {
    const cleanName = product.cleanName.toLowerCase();
    if (!productMap.has(cleanName)) {
      productMap.set(cleanName, []);
    }
    productMap.get(cleanName)!.push(product);
  });

  cards.forEach(card => {
    // Try to find exact match first
    const cardName = card.name.toLowerCase();
    const setName = card.set.name.toLowerCase();
    
    // Look for products matching this card
    const potentialProducts = productMap.get(cardName) || [];
    
    // Try to match by set name as well
    const matchingProduct = potentialProducts.find(product => {
      const productName = product.name.toLowerCase();
      return productName.includes(setName) || productName.includes(card.number);
    });

    if (matchingProduct) {
      mapping.set(card.id, matchingProduct.productId);
    } else if (card.tcgplayer?.url) {
      // Try to extract from URL if available
      const tcgPlayerId = extractTCGPlayerIdFromUrl(card.tcgplayer.url);
      if (tcgPlayerId) {
        mapping.set(card.id, parseInt(tcgPlayerId));
      }
    }
  });

  return mapping;
}

/**
 * Validate card data before insertion
 */
export function validateCardData(card: Prisma.CardCreateInput): boolean {
  const schema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    supertype: z.nativeEnum(Supertype),
    imageUrlSmall: z.string().url(),
    imageUrlLarge: z.string().url(),
    number: z.string().min(1),
  });

  try {
    schema.parse(card);
    return true;
  } catch (error) {
    console.error(`Validation failed for card ${card.id}:`, error);
    return false;
  }
}

/**
 * Handle and validate image URLs
 */
export function handleImageUrls(imageUrl: string): { isValid: boolean; url: string } {
  try {
    const url = new URL(imageUrl);
    
    // Ensure HTTPS
    if (url.protocol !== 'https:') {
      url.protocol = 'https:';
    }
    
    // Validate it's from expected domains
    const validDomains = ['images.pokemontcg.io', 'cdn.pokemontcg.io'];
    const isValidDomain = validDomains.some(domain => url.hostname.includes(domain));
    
    return {
      isValid: isValidDomain,
      url: url.toString(),
    };
  } catch {
    return {
      isValid: false,
      url: imageUrl,
    };
  }
}

/**
 * Format pricing data from TCGPlayer
 */
export function formatPricingData(
  cardId: string,
  tcgPlayerPrice: any
): Prisma.CardPriceCreateManyInput[] {
  const prices: Prisma.CardPriceCreateManyInput[] = [];
  
  // Normal prices
  if (tcgPlayerPrice.prices?.normal) {
    const normal = tcgPlayerPrice.prices.normal;
    
    if (normal.low) {
      prices.push({
        cardId,
        source: 'TCGPLAYER',
        priceType: 'LOW',
        price: new Prisma.Decimal(normal.low),
        currency: 'USD',
      });
    }
    
    if (normal.mid) {
      prices.push({
        cardId,
        source: 'TCGPLAYER',
        priceType: 'MID',
        price: new Prisma.Decimal(normal.mid),
        currency: 'USD',
      });
    }
    
    if (normal.high) {
      prices.push({
        cardId,
        source: 'TCGPLAYER',
        priceType: 'HIGH',
        price: new Prisma.Decimal(normal.high),
        currency: 'USD',
      });
    }
    
    if (normal.market) {
      prices.push({
        cardId,
        source: 'TCGPLAYER',
        priceType: 'MARKET',
        price: new Prisma.Decimal(normal.market),
        currency: 'USD',
      });
    }
  }
  
  // Holofoil prices
  if (tcgPlayerPrice.prices?.holofoil) {
    const holofoil = tcgPlayerPrice.prices.holofoil;
    
    if (holofoil.low) {
      prices.push({
        cardId,
        source: 'TCGPLAYER',
        priceType: 'FOIL_LOW',
        price: new Prisma.Decimal(holofoil.low),
        currency: 'USD',
      });
    }
    
    if (holofoil.market) {
      prices.push({
        cardId,
        source: 'TCGPLAYER',
        priceType: 'FOIL_MARKET',
        price: new Prisma.Decimal(holofoil.market),
        currency: 'USD',
      });
    }
    
    if (holofoil.high) {
      prices.push({
        cardId,
        source: 'TCGPLAYER',
        priceType: 'FOIL_HIGH',
        price: new Prisma.Decimal(holofoil.high),
        currency: 'USD',
      });
    }
  }
  
  return prices;
}

/**
 * Transform API response to database format with error handling
 */
export async function transformAndValidateCard(
  apiCard: PokemonTCGCard
): Promise<{ isValid: boolean; data?: Prisma.CardCreateInput; errors?: string[] }> {
  const errors: string[] = [];
  
  try {
    const cardData = normalizeCardData(apiCard);
    
    // Validate required fields
    if (!validateCardData(cardData)) {
      errors.push('Basic validation failed');
    }
    
    // Validate image URLs
    const smallImageValidation = handleImageUrls(cardData.imageUrlSmall);
    const largeImageValidation = handleImageUrls(cardData.imageUrlLarge);
    
    if (!smallImageValidation.isValid) {
      errors.push(`Invalid small image URL: ${cardData.imageUrlSmall}`);
    }
    
    if (!largeImageValidation.isValid) {
      errors.push(`Invalid large image URL: ${cardData.imageUrlLarge}`);
    }
    
    // Update URLs if needed
    cardData.imageUrlSmall = smallImageValidation.url;
    cardData.imageUrlLarge = largeImageValidation.url;
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    return { isValid: true, data: cardData };
  } catch (error) {
    errors.push(`Transformation error: ${error}`);
    return { isValid: false, errors };
  }
}