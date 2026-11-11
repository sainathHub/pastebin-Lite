import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'pastebin-lite',
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    }
  );
}
