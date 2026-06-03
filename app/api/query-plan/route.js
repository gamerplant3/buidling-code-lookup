import { CohereClient } from 'cohere-ai';
import { NextResponse } from 'next/server';
import { filterSchemaPrompt } from '@/lib/siteSchema';

export async function POST(request) {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'COHERE_API_KEY missing. Copy .env.example to .env.local and add your trial key.',
      },
      { status: 500 }
    );
  }

  const { query } = await request.json();
  if (!query || !String(query).trim()) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 });
  }

  const model = process.env.COHERE_MODEL || 'command-r-08-2024';
  const cohere = new CohereClient({ token: apiKey });

  const systemPrompt = `You translate natural-language site search requests into a JSON filter plan for a Canadian building portfolio MVP.

Rules:
- Output ONLY valid JSON, no markdown fences.
- Use only fields and operators from this schema:
${filterSchemaPrompt()}
- For "reserve", "solar", "PV", "roof capacity" use reserveAssessment.pass (boolean).
- Zoning: map user terms to lowercase strings like commercial, industrial, residential.
- roadFrontageM is numeric metres.
- If the user asks to sort, include sort; otherwise omit sort.
- explanation: one sentence describing what you understood.

Example output:
{"filters":[{"field":"reserveAssessment.pass","op":"eq","value":true},{"field":"zoning","op":"in","value":["commercial"]},{"field":"roadFrontageM","op":"gte","value":30}],"sort":{"field":"reserveAssessment.deltaKPa","dir":"desc"},"explanation":"Commercial sites with roof reserve and at least 30m frontage."}`;

  try {
    const response = await cohere.chat({
      model,
      message: String(query).trim(),
      preamble: systemPrompt,
      temperature: 0.1,
    });

    const text = response.text?.trim() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Could not parse filter plan from Cohere', raw: text },
        { status: 422 }
      );
    }

    const plan = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(plan.filters)) {
      plan.filters = [];
    }

    return NextResponse.json({ plan, model });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Cohere request failed' },
      { status: 500 }
    );
  }
}
