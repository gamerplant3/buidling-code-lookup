import { readFile } from 'fs/promises';
import path from 'path';

let cache = null;

export async function loadCodeEditions() {
  if (!cache) {
    const raw = await readFile(path.join(process.cwd(), 'data', 'code-editions.json'), 'utf-8');
    cache = JSON.parse(raw);
  }
  return cache;
}

export async function editionForYear(constructionYear) {
  const year = Number(constructionYear);
  const editions = await loadCodeEditions();
  const hit = editions.find((e) => year <= e.maxYear);
  return hit || editions[editions.length - 1];
}
