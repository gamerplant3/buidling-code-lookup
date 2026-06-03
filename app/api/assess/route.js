import { NextResponse } from 'next/server';

const ENGINE_URL = process.env.ENGINE_URL || 'http://127.0.0.1:8000';

export async function POST(request) {
  const body = await request.json();

  try {
    const res = await fetch(`${ENGINE_URL}/assess`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Engine error: ${text}` },
        { status: 502 }
      );
    }

    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json(
      {
        error:
          'Python engine not reachable. Run `npm start` (starts web + engine) or `npm run start:engine` in another terminal.',
        detail: e.message,
      },
      { status: 503 }
    );
  }
}
