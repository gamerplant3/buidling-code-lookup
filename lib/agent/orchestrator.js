import { CohereClient } from 'cohere-ai';
import { getCohereModel } from '@/lib/agent/cohereModel';
import { filterSchemaPrompt } from '@/lib/siteSchema';
import { AGENT_TOOLS, executeAgentTool } from '@/lib/agent/tools';
import { summarizeSite } from '@/lib/agent/summarizeSite';

const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are Scout, a structural engineering assistant for Canadian rooftop solar snow-reserve screening.

## Rules
1. **Never compute snow loads or reserve margins in prose** - always call \`assess_roof_reserve\`.
2. New addresses: geocode_address → enrich_location → assess_roof_reserve.
3. If geocode_address returns **multiple** results (\`multiple: true\`), the UI shows a location picker - **do not** list the options in your reply. Say only: e.g. "Multiple matches - pick a location above." Do **not** assess or ask about adding to the portfolio until the user picks one.
4. Portfolio questions only: use search_portfolio / get_portfolio_site when the user asks about their **loaded portfolio** (filter, list, compare sites). **Never** call search_portfolio during new-address diligence or after the user picks a geocode option.
5. Flag **IDW climate** briefly when applicable (lower confidence).
6. Note Commentary L flags only when wood structure or satisfactory performance affects the result.
7. Ask **"Would you like to add this site to your portfolio?"** only after \`assess_roof_reserve\` succeeds for a **single confirmed** location (not while geocode is ambiguous). Do **not** call \`add_site_to_portfolio\` until the user explicitly confirms (yes / add / save).
8. Portfolio site **names** must come from the geocoded address or the user's building description - never include "Scout" or rename existing portfolio sites.

## Response style (mandatory)
- **Be brief.** Target ~60–90 words for single-site diligence unless the user asks for detail.
- Use short sections on consecutive lines - **Verdict**, **Climate**, **Assumptions** (compact bullets). No blank lines between sections.
- **Verdict** must always include pass/fail **and** key numbers from assess_roof_reserve: deltaKPa, factoredHistoricKPa, totalActualDemandKPa, specifiedSnowCurrentKPa. If fail / no reserve, state the shortfall (e.g. deltaKPa is negative - report magnitude). Never say "no reserve" without these figures.
- Skip long citations - cite 1–2 key trail lines max.
- **Do not** include disclaimers, screening notices, "not a permit/final design", Ca=1 notes, or repeat text from assessment.disclaimer - the app shows that elsewhere.
- State defaults used (year, roof weight) in one line if not provided.
- For portfolio queries, lead with the count/list, then one sentence of insight.

## Portfolio filter schema (search_portfolio)
Use \`applyFilter: true\` only when the user explicitly asks to filter the site list / map. Otherwise keep \`applyFilter\` false.
${filterSchemaPrompt()}

## Reserve terminology
- "pass" / "reserve" / "solar capacity" → \`reserveAssessment.pass\`
- \`deltaKPa\` → \`reserveAssessment.deltaKPa\``;

function constructionYearFromText(text) {
  const match = String(text || '').match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  return match ? Number(match[1]) : null;
}

function transcriptText(history, message) {
  return [...history, { role: 'user', content: message }]
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
}

/** After user picks a geocode option - run enrich + assess deterministically. */
async function assessConfirmedLocation({
  selectedLocation,
  history,
  message,
  sites,
  sideEffects,
  diligenceContext,
}) {
  const lat = Number(selectedLocation.lat);
  const lng = Number(selectedLocation.lng);
  const label = selectedLocation.label || '';
  const transcript = transcriptText(history, message);

  sideEffects.geocodeCandidates = null;
  sideEffects.lastDiligence = { lat, lng, address: label, label };
  sideEffects.mapFocus = { lat, lng, label: label || null };

  const constructionYear =
    diligenceContext?.constructionYear ||
    constructionYearFromText(transcript) ||
    1990;
  const replaceBallastedWithAdhered = /ballast/i.test(transcript);

  const ctx = { sites, sideEffects, diligenceContext };
  const calls = [];

  const enrichArgs = { lat, lng };
  const enrichResult = await executeAgentTool('enrich_location', enrichArgs, ctx);
  calls.push({ name: 'enrich_location', args: enrichArgs, result: enrichResult });

  const assessArgs = {
    constructionYear,
    lat,
    lng,
    locationKey: sideEffects.lastDiligence?.locationKey,
    elevationM: sideEffects.lastDiligence?.elevationM,
    replaceBallastedWithAdhered,
  };
  const assessResult = await executeAgentTool('assess_roof_reserve', assessArgs, ctx);
  calls.push({ name: 'assess_roof_reserve', args: assessArgs, result: assessResult });

  return {
    step: 1,
    toolPlan: 'Confirmed location - enrich and assess',
    calls,
  };
}

function isLocationPending(sideEffects) {
  return (sideEffects.geocodeCandidates?.length ?? 0) > 1;
}

function offersPortfolioAdd(sideEffects) {
  return Boolean(sideEffects.lastDiligence?.assessment && !isLocationPending(sideEffects));
}

/** Sanitize reply and append portfolio-add prompt when appropriate. */
function finalizeReply(reply, sideEffects) {
  let text = String(reply || '').trim();

  if (isLocationPending(sideEffects)) {
    text = text.replace(/Would you like to add this site to your portfolio\??/gi, '');
    text = text.replace(/please choose one of the following:?/gi, '');
    text = text.replace(/I found multiple (?:results|matches)[^.]*\.?\s*/gi, '');
    text = text.replace(/^\s*\d+\.\s*.+$/gm, '');
    text = text.replace(/\n{2,}/g, '\n').trim();
    return text || 'Multiple matches - pick a location above.';
  }

  if (offersPortfolioAdd(sideEffects) && !/add this site to your portfolio/i.test(text)) {
    text = `${text}\n\nWould you like to add this site to your portfolio?`;
  }

  return text;
}

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
    return '\n\n[Portfolio: empty - user may ask about a new address.]';
  }
  const compact = loaded.map(summarizeSite).filter(Boolean);
  return `\n\n[Portfolio context - ${loaded.length} sites loaded]\n${JSON.stringify(compact)}`;
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

export async function runDiligenceAgent({
  message,
  history = [],
  sites = [],
  diligenceContext = null,
  selectedLocation = null,
}) {
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
    applyPortfolioFilter: false,
  };
  const toolTrace = [];

  if (selectedLocation?.lat != null && selectedLocation?.lng != null) {
    toolTrace.push(
      await assessConfirmedLocation({
        selectedLocation,
        history,
        message,
        sites,
        sideEffects,
        diligenceContext,
      })
    );

    const assessment = sideEffects.lastDiligence?.assessment;
    const summaryMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user',
        content: `${String(message).trim()}\n\n[Location confirmed and assess_roof_reserve completed. Summarize Verdict, Climate, Assumptions from this assessment JSON. Do not call tools. Do not mention other portfolio sites.]\n${JSON.stringify(assessment)}`,
      },
    ];

    const summary = await chatWithTools(cohere, {
      model,
      messages: summaryMessages,
      temperature: 0.2,
    });

    let reply = finalizeReply(
      extractAssistantText(summary.message?.content) || '',
      sideEffects
    );

    if (!reply) {
      reply = finalizeReply(
        'Assessment complete. See tool trace for details.',
        sideEffects
      );
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
      offersPortfolioAdd: offersPortfolioAdd(sideEffects),
      applyPortfolioFilter: sideEffects.applyPortfolioFilter,
      locationPending: false,
      finishReason: summary.finishReason || 'COMPLETE',
      model,
    };
  }

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

  reply = finalizeReply(reply, sideEffects);

  return {
    reply,
    toolTrace,
    filterPlan: sideEffects.filterPlan,
    matchedSiteIds: sideEffects.matchedSiteIds,
    highlightSiteIds: sideEffects.highlightSiteIds,
    mapFocus: sideEffects.mapFocus,
    geocodeCandidates: sideEffects.geocodeCandidates,
    siteToAdd: sideEffects.siteToAdd,
    offersPortfolioAdd: offersPortfolioAdd(sideEffects),
    applyPortfolioFilter: sideEffects.applyPortfolioFilter,
    locationPending: isLocationPending(sideEffects),
    finishReason,
    model,
  };
}
