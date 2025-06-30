#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';
import { PokemonTCGClient } from '../lib/api/pokemon-tcg-client';
import { transformAndValidateCard } from '../lib/api/transformers';

const prisma = new PrismaClient();

async function testSingleCard() {
  console.log('Testing single card import...\n');
  
  const client = new PokemonTCGClient(process.env.POKEMON_TCG_API_KEY);
  
  try {
    // Get a specific card
    const cardResult = await client.getCardById('sv10-3'); // Yanmega ex
    
    if (!cardResult || cardResult.error) {
      console.error('Failed to fetch card:', cardResult?.error);
      return;
    }
    
    const apiCard = cardResult.data.data;
    console.log('Fetched card:', apiCard.name);
    
    // Transform it
    const transformResult = await transformAndValidateCard(apiCard);
    console.log('Transform result:', {
      isValid: transformResult.isValid,
      hasData: !!transformResult.data,
      priceCount: transformResult.prices?.length || 0,
      errors: transformResult.errors
    });
    
    if (transformResult.isValid && transformResult.data) {
      // Try to create it
      const set = await prisma.set.findUnique({
        where: { code: 'sv10' }
      });
      
      if (!set) {
        console.error('Set sv10 not found');
        return;
      }
      
      const newCard = await prisma.card.create({
        data: {
          id: apiCard.id,
          ...transformResult.data,
          set: {
            connect: { id: set.id }
          }
        }
      });
      
      console.log('✅ Card created:', newCard.id, newCard.name);
      
      // Add prices
      if (transformResult.prices && transformResult.prices.length > 0) {
        const validPrices = transformResult.prices.filter(p => p.source !== undefined);
        await prisma.cardPrice.createMany({
          data: validPrices.map(p => ({ ...p, cardId: newCard.id }))
        });
        console.log(`✅ Added ${validPrices.length} prices`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSingleCard();