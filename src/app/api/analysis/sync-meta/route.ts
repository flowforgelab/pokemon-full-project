/**
 * API Route for syncing tournament meta data
 * 
 * This can be called manually or via cron job to update meta information
 * from Limitless TCG tournament results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { metaSyncService } from '@/lib/services/meta-sync-service';
import { Format } from '@prisma/client';

// Protect with secret for cron jobs
const SYNC_SECRET = process.env.META_SYNC_SECRET || process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  try {
    // Check authentication - either admin user or valid secret
    const { userId } = await auth();
    const authHeader = req.headers.get('authorization');
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    // Require admin role or valid secret
    const hasValidSecret = SYNC_SECRET && providedSecret === SYNC_SECRET;
    
    if (!hasValidSecret && !userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // TODO: Add admin role check for userId
    
    // Parse request
    const body = await req.json();
    const { format = 'STANDARD', action = 'sync' } = body;
    
    switch (action) {
      case 'sync': {
        // Sync current meta
        const snapshot = await metaSyncService.syncCurrentMeta(format as Format);
        
        return NextResponse.json({
          success: true,
          message: `Synced ${snapshot.topDecks.length} archetypes from ${snapshot.tournamentCount} tournaments`,
          snapshot: {
            date: snapshot.date,
            format: snapshot.format,
            topDecks: snapshot.topDecks.slice(0, 5), // Top 5 for summary
            totalPlayers: snapshot.totalPlayers
          }
        });
      }
      
      case 'analyze': {
        // Analyze a specific deck against meta
        const { cards } = body;
        if (!cards || !Array.isArray(cards)) {
          return NextResponse.json(
            { error: 'Cards array required for analysis' },
            { status: 400 }
          );
        }
        
        const analysis = await metaSyncService.analyzeAgainstTournamentMeta(cards, format);
        
        return NextResponse.json({
          success: true,
          analysis
        });
      }
      
      case 'fetch-decklists': {
        // Fetch sample decklists for an archetype
        const { archetype, limit = 5 } = body;
        if (!archetype) {
          return NextResponse.json(
            { error: 'Archetype required' },
            { status: 400 }
          );
        }
        
        const decklists = await metaSyncService.fetchArchetypeDecklists(archetype, limit);
        
        return NextResponse.json({
          success: true,
          decklists
        });
      }
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('Meta sync error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync meta data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Public endpoint to check last sync status
    // TODO: Implement fetching last sync from database
    
    return NextResponse.json({
      lastSync: null,
      message: 'Meta sync status endpoint'
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}