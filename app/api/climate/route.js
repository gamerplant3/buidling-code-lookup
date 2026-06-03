import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', 'table-c2-ontario.json');
  const raw = await readFile(filePath, 'utf-8');
  return NextResponse.json(JSON.parse(raw));
}
