import axios from 'axios';

const POKEMON_TCG_API_URL = process.env.POKEMON_TCG_API_URL || 'https://api.pokemontcg.io/v2';
const POKEMON_TCG_API_KEY = process.env.POKEMON_TCG_API_KEY;

export const pokemonTCGClient = axios.create({
  baseURL: POKEMON_TCG_API_URL,
  headers: {
    'X-Api-Key': POKEMON_TCG_API_KEY || '',
  },
});

export interface PokemonCard {
  id: string;
  name: string;
  supertype: string;
  subtypes: string[];
  types?: string[];
  hp?: string;
  evolvesFrom?: string;
  abilities?: Array<{
    name: string;
    text: string;
    type: string;
  }>;
  attacks?: Array<{
    name: string;
    cost: string[];
    damage: string;
    text: string;
  }>;
  weaknesses?: Array<{
    type: string;
    value: string;
  }>;
  resistances?: Array<{
    type: string;
    value: string;
  }>;
  retreatCost?: string[];
  set: {
    id: string;
    name: string;
    series: string;
    printedTotal: number;
    total: number;
    releaseDate: string;
    images: {
      symbol: string;
      logo: string;
    };
  };
  number: string;
  artist?: string;
  rarity?: string;
  images: {
    small: string;
    large: string;
  };
  tcgplayer?: {
    url: string;
    prices?: {
      [key: string]: {
        low: number;
        mid: number;
        high: number;
        market: number;
      };
    };
  };
}

export interface SearchCardsParams {
  q?: string;
  page?: number;
  pageSize?: number;
  orderBy?: string;
}

export async function searchCards(params: SearchCardsParams) {
  const response = await pokemonTCGClient.get<{
    data: PokemonCard[];
    page: number;
    pageSize: number;
    count: number;
    totalCount: number;
  }>('/cards', {
    params,
  });
  
  return response.data;
}

export async function getCardById(id: string) {
  const response = await pokemonTCGClient.get<{
    data: PokemonCard;
  }>(`/cards/${id}`);
  
  return response.data.data;
}