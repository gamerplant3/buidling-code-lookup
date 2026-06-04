import { NextResponse } from 'next/server';
import { getCohereModel } from '@/lib/agent/cohereModel';

/** GET /api/agent/config — public agent metadata (no secrets). */
export async function GET() {
  return NextResponse.json({ model: getCohereModel(), provider: 'Cohere' });
}
