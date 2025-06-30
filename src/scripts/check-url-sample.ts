#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUrlSample() {
  try {
    const samples = await prisma.card.findMany({
      where: {
        name: {
          in: ['Abra', 'Pikachu', 'Charizard']
        }
      },
      select: {
        name: true,
        purchaseUrl: true,
        set: { select: { name: true } }
      }
    });
    
    console.log('📋 Sample TCGPlayer URLs:\n');
    
    samples.forEach(card => {
      console.log(`${card.name} (${card.set.name}):`);
      console.log(`${card.purchaseUrl}\n`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUrlSample();