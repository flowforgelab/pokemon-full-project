import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEvolutions() {
  try {
    const deck = await prisma.deck.findFirst({
      where: {
        name: { contains: 'Rayquaza', mode: 'insensitive' }
      },
      include: {
        cards: {
          include: {
            card: true
          },
          where: {
            card: {
              OR: [
                { name: { contains: 'Magnemite' } },
                { name: { contains: 'Magneton' } },
                { name: { contains: 'Magnezone' } }
              ]
            }
          }
        }
      }
    });
    
    if (!deck) {
      console.log('No deck found');
      return;
    }
    
    console.log('Magnemite evolution line in deck:');
    deck.cards.forEach(dc => {
      console.log(`${dc.quantity}x ${dc.card.name}`);
      console.log(`  Evolves from: ${dc.card.evolvesFrom || 'BASIC'}`);
      console.log(`  Subtypes: ${dc.card.subtypes.join(', ')}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEvolutions().catch(console.error);