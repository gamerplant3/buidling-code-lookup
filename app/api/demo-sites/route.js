import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { stripPortfolioAssessments } from '@/lib/demoSites';

const DEMO_FILE = path.join(process.cwd(), 'data', 'demo-sites.json');

/** Fictional portfolio sites only (no baked-in climate or assessment results). */
export async function GET() {
  const raw = await readFile(DEMO_FILE, 'utf-8');
  const sites = stripPortfolioAssessments(JSON.parse(raw));
  return NextResponse.json(sites);
}
