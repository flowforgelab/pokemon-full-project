import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/server/db/prisma';
import { CollectionManager } from '@/lib/collection/collection-manager';

// GET /api/collection/value - Get collection value and performance
export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') || 'current';

    const manager = new CollectionManager();

    switch (type) {
      case 'current':
        const currentValue = await manager.valueTracker.calculateCurrentValue(user.id);
        return NextResponse.json(currentValue);

      case 'performance':
        const performance = await manager.analyzePerformance(user.id);
        return NextResponse.json(performance);

      case 'changes':
        const _hours = parseInt(searchParams.get('hours') || '24');
        const changes = await manager.trackValueChanges(user.id);
        return NextResponse.json(changes);

      case 'insurance':
        const insuranceReport = await manager.generateInsuranceReport(user.id);
        return NextResponse.json(insuranceReport);

      default:
        return NextResponse.json(
          { error: 'Invalid value type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error getting collection value:', error);
    return NextResponse.json(
      { error: 'Failed to get collection value' },
      { status: 500 }
    );
  }
}

// POST /api/collection/value/alert - Set price alert
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await req.json();
    const { cardId, threshold, type } = body;

    if (!cardId || !threshold || !type) {
      return NextResponse.json(
        { error: 'Card ID, threshold, and type are required' },
        { status: 400 }
      );
    }

    // Create price alert
    const alert = await prisma.priceAlert.create({
      data: {
        userId: user.id,
        cardId,
        targetPrice: threshold,
        alertType: type === 'increase' ? 'ABOVE' : 'BELOW',
        priceType: 'MARKET',
        currency: 'USD',
        isActive: true,
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error setting price alert:', error);
    return NextResponse.json(
      { error: 'Failed to set price alert' },
      { status: 500 }
    );
  }
}