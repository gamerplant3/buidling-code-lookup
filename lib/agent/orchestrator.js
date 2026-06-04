import { CohereClient } from 'cohere-ai';
import { getCohereModel } from '@/lib/agent/cohereModel';
import { filterSchemaPrompt } from '@/lib/siteSchema';
import { AGENT_TOOLS, executeAgentTool } from '@/lib/agent/tools';
import { summarizeSite } from '@/lib/agent/summarizeSite';

const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are a structural engineering assistant for Canadian rooftop solar snow-reserve screening.

## Rules
1. **Never compute snow loads or reserve margins in prose** — always call \`assess_roof_reserve\`.
2. New addresses: geocode_address → enrich_location → assess_roof_reserve.
3. If geocode_address returns **multiple** results, list numbered options (label + province) and ask the user to pick one. Do **not** assess until the user chooses.
4. Portfolio questions: search_portfolio / get_portfolio_site. Use **exact site names** from portfolio context.
5. Flag **IDW climate** briefly when applicable (lower confidence).
6. Note Commentary L flags only when wood structure or satisfactory performance affects the result.
7. After new-address diligence (site not already in portfolio), ask: **"Would you like to add this site to your portfolio?"** Do **not** call \`add_site_to_portfolio\` until the user explicitly confirms (yes / add / save).

## Response style (mandatory)
- **Be brief.** Target ~60–90 words for single-site diligence unless the user asks for detail.
- Use short sections on consecutive lines — **Verdict**, **Climate**, **Assumptions** (compact bullets). No blank lines between sections.
- **Verdict** must always include pass/fail **and** key numbers from assess_roof_reserve: deltaKPa, factoredHistoricKPa, totalActualDemandKPa, specifiedSnowCurrentKPa. If fail / no reserve, state the shortfall (e.g. deltaKPa is negative — report magnitude). Never say "no reserve" without these figures.
- Skip long citations — cite 1–2 key trail lines max.
- **Do not** include disclaimers, screening notices, "not a permit/final design", Ca=1 notes, or repeat text from assessment.disclaimer — the app shows that elsewhere.
- State defaults used (year, roof weight) in one line if not provided.
- For portfolio queries, lead with the count/list, then one sentence of insight.

## Portfolio filter schema (search_portfolio)
${filterSchemaPrompt()}

## Reserve terminology
- "pass" / "reserve" / "solar capacity" → \`reserveAssessment.pass\`
- \`deltaKPa\` → \`reserveAssessment.deltaKPa\``;

function extractAssistantText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((block) => block?.type === 'text' && block.text)
    .map((block) => block.text)
    .join('\n\n');
}

function portfolioContextBlock(sites) {
  const loaded = (sites || []).filter(Boolean);
  if (!loaded.length) {
    return '\n\n[Portfolio: empty — user may ask about a new address.]';
  }
  const compact = loaded.map(summarizeSite).filter(Boolean);
  return `\n\n[Portfolio context — ${loaded.length} sites loaded]\n${JSON.stringify(compact)}`;
}

function isInvalidToolGenerationError(err) {
  const type = err?.body?.error_type || err?.body?.errorType;
  const msg = String(err?.body?.message || err?.message || '').toLowerCase();
  return type === 'INVALID_TOOL_GENERATION' || msg.includes('invalid tool generation');
}

async function chatWithTools(cohere, params, maxAttempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await cohere.v2.chat(params);
    } catch (err) {
      lastError = err;
      if (!isInvalidToolGenerationError(err) || attempt === maxAttempts - 1) throw err;
    }
  }
  throw lastError;
}

function trimToolResult(name, result) {
  const s = JSON.stringify(result);
  if (s.length <= 8000) return result;
  if (name === 'assess_roof_reserve' && result.assessment) {
    return {
      assessment: {
        ...result.assessment,
        trailCalc: (result.assessment.trailCalc || []).slice(0, 3),
        note: 'Trail truncated for context length',
      },
    };
  }
  return { ...result, note: 'Result truncated for context length', preview: s.slice(0, 4000) };
}

export async function runDiligenceAgent({ message, history = [], sites = [], diligenceContext = null }) {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new Error('COHERE_API_KEY missing. Copy .env.example to .env.local and add your trial key.');
  }

  const model = getCohereModel();
  const cohere = new CohereClient({ token: apiKey });

  const sideEffects = {
    filterPlan: null,
    matchedSiteIds: [],
    highlightSiteIds: [],
    mapFocus: null,
    geocodeCandidates: null,
    siteToAdd: null,
    lastDiligence: null,
  };
  const toolTrace = [];

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: String(message).trim() + portfolioContextBlock(sites),
    },
  ];

  let reply = '';
  let finishReason = 'UNKNOWN';

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await chatWithTools(cohere, {
      model,
      messages,
      tools: AGENT_TOOLS,
      strictTools: true,
      temperature: 0.2,
    });

    finishReason = response.finishReason || 'UNKNOWN';
    const assistantMsg = response.message;

    if (assistantMsg?.toolPlan || assistantMsg?.toolCalls?.length) {
      messages.push({ ...assistantMsg, role: assistantMsg.role || 'assistant' });
    }

    const toolCalls = assistantMsg?.toolCalls || [];
    if (!toolCalls.length || finishReason !== 'TOOL_CALL') {
      reply = extractAssistantText(assistantMsg?.content) || assistantMsg?.toolPlan || '';
      break;
    }

    const stepRecord = {
      step: step + 1,
      toolPlan: assistantMsg.toolPlan || null,
      calls: [],
    };

    for (const tc of toolCalls) {
      const fnName = tc.function?.name;
      let args = {};
      try {
        args = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        args = {};
      }

      let result;
      let error;
      try {
        result = await executeAgentTool(fnName, args, { sites, sideEffects, diligenceContext });
        result = trimToolResult(fnName, result);
      } catch (e) {
        error = e.message;
        result = { error: e.message };
      }

      stepRecord.calls.push({ name: fnName, args, result, error });

      messages.push({
        role: 'tool',
        toolCallId: tc.id,
        content: JSON.stringify(result),
      });
    }

    toolTrace.push(stepRecord);
  }

  if (!reply && toolTrace.length) {
    reply =
      'I ran the requested tools but could not finish a summary. Check the tool trace or try a simpler question.';
  }

  return {
    reply,
    toolTrace,
    filterPlan: sideEffects.filterPlan,
    matchedSiteIds: sideEffects.matchedSiteIds,
    highlightSiteIds: sideEffects.highlightSiteIds,
    mapFocus: sideEffects.mapFocus,
    geocodeCandidates: sideEffects.geocodeCandidates,
    siteToAdd: sideEffects.siteToAdd,
    finishReason,
    model,
  };
}
