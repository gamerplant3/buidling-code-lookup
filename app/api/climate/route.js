import { readFile } from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

const TABLE_FILE = 'table-c2-canada.json';

export async function GET() {
  const filePath = path.join(process.cwd(), 'data', TABLE_FILE);
  try {
    const raw = await readFile(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      {
        error: `Missing ${TABLE_FILE}. Run: python scripts/import_pcic_table_c2.py`,
      },
      { status: 404 }
    );
  }
}
