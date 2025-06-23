import { Rarity, Supertype } from '@prisma/client';

export interface Card {
  id: string;
  name: string;
  supertype: Supertype;
  subtypes: string[];
  level?: string | null;
  hp?: string | null;
  types: string[];
  evolvesFrom?: string | null;
  evolvesTo: string[];
  
  attacks?: any;
  abilities?: any;
  weaknesses?: any;
  resistances?: any;
  rules: string[];
  
  retreatCost: string[];
  convertedRetreatCost: number;
  
  set?: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: Date;
    logoUrl?: string | null;
    symbolUrl?: string | null;
  };
  
  number: string;
  printedNumber?: string | null;
  
  artist?: string | null;
  rarity?: Rarity | null;
  flavorText?: string | null;
  nationalPokedexNumbers: number[];
  
  imageUrlSmall: string;
  imageUrlLarge: string;
  
  tcgplayerId?: string | null;
  cardmarketId?: string | null;
  
  isLegalStandard: boolean;
  isLegalExpanded: boolean;
  isLegalUnlimited: boolean;
}

export interface DeckCard {
  cardId: string;
  quantity: number;
  card?: Card;
}

export interface Deck {
  id: string;
  name: string;
  description?: string | null;
  formatId: string;
  userId: string;
  isPublic: boolean;
  cards: DeckCard[];
  createdAt: Date;
  updatedAt: Date;
}