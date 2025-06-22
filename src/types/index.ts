export type { AppRouter } from '@/server/routers/_app';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type DeckFormat = 'STANDARD' | 'EXPANDED' | 'UNLIMITED' | 'GLC';

export type CardCondition = 
  | 'MINT'
  | 'NEAR_MINT'
  | 'LIGHTLY_PLAYED'
  | 'MODERATELY_PLAYED'
  | 'HEAVILY_PLAYED'
  | 'DAMAGED';

export type TradeStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED';

export interface DeckCard {
  cardId: string;
  quantity: number;
}

export interface TradeCard {
  cardId: string;
  quantity: number;
}