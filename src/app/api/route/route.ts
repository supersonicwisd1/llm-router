import { NextRequest, NextResponse } from 'next/server';
import { RouterService } from '@/lib/routing';
import { PriorityPreset } from '@/lib/types';
import { MODEL_REGISTRY, resetAllModelAvailability } from '@/lib/models/model-registry';

export async function GET() {
  try {
    // Return model availability status with detailed debugging
    const modelStatus = Object.entries(MODEL_REGISTRY).map(([key, model]) => ({
      name: key,
      modelName: model.modelName,
      provider: model.provider,
      isAvailable: model.isAvailable ?? true,
      isAvailableRaw: model.isAvailable,
      isAvailableType: typeof model.isAvailable,
      notes: model.notes
    }));
    
    console.log('API Route: GET /api/route - Model status:', modelStatus);
    
    return NextResponse.json({ models: modelStatus });
  } catch (error) {
    console.error('Model status API error:', error);
    return NextResponse.json(
      { error: 'Failed to get model status' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'reset') {
      resetAllModelAvailability();
      return NextResponse.json({ message: 'All models reset to available' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Model reset API error:', error);
    return NextResponse.json(
      { error: 'Failed to reset models' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, priorityPreset = PriorityPreset.BALANCED } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Prompt is required and must be a string' },
        { status: 400 }
      );
    }

    console.log('API Route: Processing request', { prompt, priorityPreset });

    // Create router service and route the prompt
    const routerService = new RouterService();
    const result = await routerService.routePrompt(prompt, priorityPreset);

    console.log('API Route: Success', { 
      promptType: result.promptType, 
      modelUsed: result.modelUsed,
      confidence: result.classificationConfidence 
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Routing API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Routing failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
