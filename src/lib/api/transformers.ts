import { Prisma, Rarity, Supertype, PriceSource, PriceType } from '@prisma/client';
import type { PokemonTCGCard, PokemonTCGSet } from './types';
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
    cardmarketId: apiCard.cardmarket?.url ? extractCardMarketIdFromUrl(apiCard.cardmarket.url) : null,
    isLegalStandard: apiCard.legalities.standard === 'Legal',
    isLegalExpanded: apiCard.legalities.expanded === 'Legal',
    isLegalUnlimited: apiCard.legalities.unlimited === 'Legal',
  };
}

/**
 * Extract CardMarket product ID from URL
 */
function extractCardMarketIdFromUrl(url: string): string | null {
  const match = url.match(/\/Products\/Singles\/[^\/]+\/(\d+)/);
  return match ? match[1] : null;
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
 * Extract pricing data from Pokemon TCG API card
 */
export function extractPricingData(apiCard: PokemonTCGCard): Prisma.CardPriceCreateInput[] {
  const prices: Prisma.CardPriceCreateInput[] = [];
  const updatedAt = new Date();

  // Extract TCGPlayer prices (USD)
  if (apiCard.tcgplayer?.prices) {
    const tcgPrices = apiCard.tcgplayer.prices;
    
    // Normal prices
    if (tcgPrices.normal) {
      if (tcgPrices.normal.low) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.LOW,
          price: tcgPrices.normal.low,
          currency: 'USD',
          updatedAt,
        });
      }
      if (tcgPrices.normal.mid) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.MID,
          price: tcgPrices.normal.mid,
          currency: 'USD',
          updatedAt,
        });
      }
      if (tcgPrices.normal.high) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.HIGH,
          price: tcgPrices.normal.high,
          currency: 'USD',
          updatedAt,
        });
      }
      if (tcgPrices.normal.market) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.MARKET,
          price: tcgPrices.normal.market,
          currency: 'USD',
          updatedAt,
        });
      }
    }

    // Holofoil prices
    if (tcgPrices.holofoil) {
      if (tcgPrices.holofoil.low) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.LOW,
          price: tcgPrices.holofoil.low,
          currency: 'USD',
          updatedAt,
        });
      }
      if (tcgPrices.holofoil.mid) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.MID,
          price: tcgPrices.holofoil.mid,
          currency: 'USD',
          updatedAt,
        });
      }
      if (tcgPrices.holofoil.high) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.HIGH,
          price: tcgPrices.holofoil.high,
          currency: 'USD',
          updatedAt,
        });
      }
      if (tcgPrices.holofoil.market) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.MARKET,
          price: tcgPrices.holofoil.market,
          currency: 'USD',
          updatedAt,
        });
      }
    }

    // Reverse holofoil prices
    if (tcgPrices.reverseHolofoil) {
      if (tcgPrices.reverseHolofoil.low) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.LOW,
          price: tcgPrices.reverseHolofoil.low,
          currency: 'USD',
          foil: true,
          condition: 'reverseHolofoil',
          updatedAt,
        });
      }
      if (tcgPrices.reverseHolofoil.market) {
        prices.push({
          cardId: apiCard.id,
          source: PriceSource.TCGPLAYER,
          priceType: PriceType.MARKET,
          price: tcgPrices.reverseHolofoil.market,
          currency: 'USD',
          foil: true,
          condition: 'reverseHolofoil',
          updatedAt,
        });
      }
    }
  }

  // Extract CardMarket prices (EUR)
  if (apiCard.cardmarket?.prices) {
    const cmPrices = apiCard.cardmarket.prices;
    
    if (cmPrices.averageSellPrice) {
      prices.push({
        cardId: apiCard.id,
        source: PriceSource.CARDMARKET,
        priceType: PriceType.MARKET,
        price: cmPrices.averageSellPrice,
        currency: 'EUR',
        updatedAt,
      });
    }
    
    if (cmPrices.lowPrice) {
      prices.push({
        cardId: apiCard.id,
        source: PriceSource.CARDMARKET,
        priceType: PriceType.LOW,
        price: cmPrices.lowPrice,
        currency: 'EUR',
        updatedAt,
      });
    }
    
    // Skip trendPrice and reverseHoloTrend as they would need different handling
    // (no condition field in schema)
  }

  return prices;
}

/**
 * Transform API response to database format with error handling
 */
export async function transformAndValidateCard(
  apiCard: PokemonTCGCard
): Promise<{ 
  isValid: boolean; 
  data?: Prisma.CardCreateInput; 
  prices?: Prisma.CardPriceCreateInput[];
  errors?: string[] 
}> {
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
    
    // Extract pricing data
    const prices = extractPricingData(apiCard);
    
    return { isValid: true, data: cardData, prices };
  } catch (error) {
    errors.push(`Transformation error: ${error}`);
    return { isValid: false, errors };
  }
}