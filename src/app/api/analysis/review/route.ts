import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { 
  reviewAnalysisWithOpenAI, 
  type DeckAnalysisPayload,
  type OpenAIReviewResponse,
  type OpenAIModelConfig
} from '@/lib/analysis/openai-analysis-reviewer';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get OpenAI API key from environment
    const openAIKey = process.env.OPENAI_API_KEY;
    if (!openAIKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { payload, systemPrompt, modelConfig } = body as {
      payload: DeckAnalysisPayload;
      systemPrompt?: string;
      modelConfig?: Partial<OpenAIModelConfig>;
    };

    if (!payload) {
      return NextResponse.json(
        { error: 'Missing analysis payload' },
        { status: 400 }
      );
    }

    // Call OpenAI to review the analysis
    const review = await reviewAnalysisWithOpenAI(
      payload,
      openAIKey,
      systemPrompt,
      modelConfig
    );

    return NextResponse.json({
      success: true,
      review
    });

  } catch (error) {
    console.error('Error in analysis review:', error);
    return NextResponse.json(
      { 
        error: 'Failed to review analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}