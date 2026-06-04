/** Default Cohere chat model for diligence agent (tool use). */
export const DEFAULT_COHERE_MODEL = 'command-r-08-2024';

export function getCohereModel() {
  return process.env.COHERE_MODEL || DEFAULT_COHERE_MODEL;
}
