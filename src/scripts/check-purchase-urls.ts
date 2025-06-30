#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPurchaseUrls() {
  try {
    const totalCards = await prisma.card.count();
    
    const directLinks = await prisma.card.count({
      where: {
        purchaseUrl: {
          contains: '/product/'
        }
      }
    });
    
    const searchLinks = await prisma.card.count({
      where: {
        purchaseUrl: {
          contains: '/search/'
        }
      }
    });
    
    const noLinks = await prisma.card.count({
      where: {
        purchaseUrl: null
      }
    });
    
    console.log('📊 Purchase URL Analysis:');
    console.log('================================');
    console.log(`Total cards: ${totalCards}`);
    console.log(`Direct TCGPlayer links: ${directLinks} (${((directLinks / totalCards) * 100).toFixed(1)}%)`);
    console.log(`Search links: ${searchLinks} (${((searchLinks / totalCards) * 100).toFixed(1)}%)`);
    console.log(`No purchase URL: ${noLinks}`);
    
    // Show a few examples of each type
    console.log('\n📋 Examples:');
    
    const directExample = await prisma.card.findFirst({
      where: { purchaseUrl: { contains: '/product/' } },
      select: { name: true, purchaseUrl: true }
    });
    if (directExample) {
      console.log(`\nDirect link example: ${directExample.name}`);
      console.log(`URL: ${directExample.purchaseUrl}`);
    }
    
    const searchExample = await prisma.card.findFirst({
      where: { purchaseUrl: { contains: '/search/' } },
      select: { name: true, purchaseUrl: true }
    });
    if (searchExample) {
      console.log(`\nSearch link example: ${searchExample.name}`);
      console.log(`URL: ${searchExample.purchaseUrl}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPurchaseUrls();