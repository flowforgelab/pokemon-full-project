#!/usr/bin/env tsx

import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(process.cwd(), '.env.local') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface SearchTestCase {
  query: string;
  description: string;
  expectedBehavior: string;
}

const testCases: SearchTestCase[] = [
  // Single character searches
  { query: 'c', description: 'Single character', expectedBehavior: 'Should return cards starting with "c"' },
  { query: 'r', description: 'Single character', expectedBehavior: 'Should return cards starting with "r"' },
  
  // Short searches
  { query: 'ch', description: 'Two characters', expectedBehavior: 'Should return Charizard, Charmander, etc.' },
  { query: 'cha', description: 'Three characters', expectedBehavior: 'Should return Charizard before Archaludon' },
  { query: 'char', description: 'Four characters', expectedBehavior: 'Should return Charizard, Charmander, Charmeleon' },
  
  // Card number searches
  { query: '172', description: 'Card number only', expectedBehavior: 'Should return cards with number 172' },
  { query: '032', description: 'Card number with leading zero', expectedBehavior: 'Should return cards with number 032' },
  { query: '39', description: 'Short card number', expectedBehavior: 'Should return cards with number 39' },
  
  // Space-separated searches
  { query: 'char 32', description: 'Name + number', expectedBehavior: 'Should find Charcadet #032' },
  { query: 'char 39', description: 'Name + number', expectedBehavior: 'Should find cards with "char" and number 39' },
  { query: 'fairy 172', description: 'Name + number', expectedBehavior: 'Should find Fairy cards with number 172' },
  
  // Common Pokemon names
  { query: 'pikachu', description: 'Full Pokemon name', expectedBehavior: 'Should return all Pikachu cards' },
  { query: 'charizard', description: 'Full Pokemon name', expectedBehavior: 'Should return all Charizard cards' },
  { query: 'mewtwo', description: 'Full Pokemon name', expectedBehavior: 'Should return all Mewtwo cards' },
  
  // Partial matches
  { query: 'zard', description: 'Partial name', expectedBehavior: 'Should return Charizard (contains match)' },
  { query: 'saur', description: 'Partial name', expectedBehavior: 'Should return Bulbasaur, Ivysaur, Venusaur' },
];

async function testSearchPerformance() {
  console.log('🔍 Testing Pokemon TCG Search Performance');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log('='.repeat(60));
  
  try {
    // Check database status
    const totalCards = await prisma.card.count();
    const totalSets = await prisma.set.count();
    console.log(`\n📊 Database Status:`);
    console.log(`  - Total cards: ${totalCards.toLocaleString()}`);
    console.log(`  - Total sets: ${totalSets}`);
    console.log('='.repeat(60));
    
    // Test each search case
    for (const testCase of testCases) {
      console.log(`\n🧪 Test: ${testCase.description}`);
      console.log(`   Query: "${testCase.query}"`);
      console.log(`   Expected: ${testCase.expectedBehavior}`);
      
      const startTime = Date.now();
      
      try {
        // Execute the same search logic as the searchOptimized endpoint
        const searchTerm = testCase.query.trim().toLowerCase();
        const isSingleChar = searchTerm.length === 1;
        
        // Check if query contains space and last part could be a number
        const parts = searchTerm.split(' ');
        const lastPart = parts[parts.length - 1];
        const hasSpaceAndNumber = parts.length > 1 && /^\d+$/.test(lastPart);
        const namePartOnly = hasSpaceAndNumber ? parts.slice(0, -1).join(' ') : searchTerm;
        const numberPartOnly = hasSpaceAndNumber ? lastPart : null;
        
        let searchCondition;
        if (hasSpaceAndNumber) {
          searchCondition = `((LOWER(c.name) LIKE $5 AND (c.number = $4 OR c.number LIKE $6)) OR c.name ILIKE $3 OR c.number ILIKE $3)`;
        } else if (isSingleChar) {
          searchCondition = `(c.name ILIKE $2 OR c.number = $1)`;
        } else {
          searchCondition = `(c.name ILIKE $3 OR c.number ILIKE $3)`;
        }
        
        const countQuery = `
          SELECT COUNT(DISTINCT c.id) as count
          FROM "Card" c
          INNER JOIN "Set" s ON c."setId" = s.id
          WHERE ${searchCondition}
        `;
        
        const searchQuery = `
          WITH search_results AS (
            SELECT DISTINCT ON (c.id)
              c.id,
              c.name,
              c.number,
              s.name as set_name,
              CASE
                WHEN LOWER(c.name) = $1 THEN 100
                WHEN c.number = $1 THEN 95
                ${hasSpaceAndNumber ? `WHEN LOWER(c.name) LIKE $5 AND (c.number = $4 OR c.number LIKE $6) THEN 92` : ''}
                WHEN LOWER(c.name) LIKE $2 THEN 90
                WHEN c.number LIKE $2 THEN 85
                WHEN LOWER(c.name) ~ ('\\\\m' || $1) THEN 70
                WHEN LOWER(c.name) LIKE $3 THEN 50
                WHEN c.number LIKE $3 THEN 45
                ELSE 0
              END as relevance_score
            FROM "Card" c
            INNER JOIN "Set" s ON c."setId" = s.id
            WHERE ${searchCondition}
          )
          SELECT * FROM search_results
          WHERE relevance_score > 0
          ORDER BY relevance_score DESC, name ASC
          LIMIT 10
        `;
        
        const queryParams = hasSpaceAndNumber ? [
          searchTerm,
          searchTerm + '%',
          '%' + searchTerm + '%',
          numberPartOnly,
          '%' + namePartOnly + '%',
          numberPartOnly + '%'
        ] : [
          searchTerm,
          searchTerm + '%',
          '%' + searchTerm + '%'
        ];
        
        // Execute count query
        const countResult = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
          countQuery,
          ...queryParams
        );
        
        // Execute search query
        const searchResults = await prisma.$queryRawUnsafe<any[]>(
          searchQuery,
          ...queryParams
        );
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        const count = Number(countResult[0]?.count || 0);
        
        console.log(`   ✅ Results: ${count} cards found`);
        console.log(`   ⏱️  Time: ${duration}ms`);
        
        if (searchResults.length > 0) {
          console.log(`   📋 Top results:`);
          searchResults.slice(0, 5).forEach((card, index) => {
            console.log(`      ${index + 1}. ${card.name} (#${card.number}) - ${card.set_name} (score: ${card.relevance_score})`);
          });
        }
        
        // Performance warnings
        if (duration > 1000) {
          console.log(`   ⚠️  WARNING: Query took over 1 second!`);
        } else if (duration > 500) {
          console.log(`   ⚠️  WARNING: Query took over 500ms`);
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Search Performance Test Complete');
    
    // Check for indexes
    console.log('\n📊 Database Indexes:');
    const indexes = await prisma.$queryRaw<any[]>`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename IN ('Card', 'Set')
      ORDER BY tablename, indexname;
    `;
    
    indexes.forEach(idx => {
      console.log(`\n  Table: ${idx.tablename}`);
      console.log(`  Index: ${idx.indexname}`);
      console.log(`  Definition: ${idx.indexdef}`);
    });
    
    // Suggest optimizations
    console.log('\n💡 Optimization Suggestions:');
    console.log('1. Create indexes for search fields if not present:');
    console.log('   - CREATE INDEX idx_card_name_lower ON "Card" (LOWER(name));');
    console.log('   - CREATE INDEX idx_card_number ON "Card" (number);');
    console.log('   - CREATE INDEX idx_card_name_trgm ON "Card" USING gin (name gin_trgm_ops);');
    console.log('2. Consider adding a full-text search index for better performance');
    console.log('3. Implement caching for common search queries');
    
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSearchPerformance()
  .then(() => {
    console.log('\n✅ Performance test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });