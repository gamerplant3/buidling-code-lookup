import { NextResponse } from 'next/server';
import { runDiligenceAgent } from '@/lib/agent/orchestrator';

/** POST /api/agent — diligence agent with Cohere tool use */
export async function POST(request) {
  try {
    const body = await request.json();
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const result = await runDiligenceAgent({
      message,
      history: body.history || [],
      sites: body.sites || [],
      diligenceContext: body.diligenceContext || null,
    });

    return NextResponse.json(result);
  } catch (e) {
    const cohereType = e.body?.error_type || e.body?.errorType;
    const message =
      e.body?.message || e.message || 'Agent request failed';
    const status =
      e.statusCode === 422 || cohereType === 'INVALID_TOOL_GENERATION'
        ? 422
        : e.message?.includes('COHERE_API_KEY')
          ? 500
          : 502;
    return NextResponse.json({ error: message, errorType: cohereType || undefined }, { status });
  }
}
